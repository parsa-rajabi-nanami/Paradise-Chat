"""
Views for user authentication and profile management.
"""

from rest_framework import generics, status, throttling
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserRegistrationSerializer,
    UserSerializer,
    UserUpdateSerializer,
    PasswordChangeSerializer,
    UserMinimalSerializer,
    UserDeleteSerializer,
)
from chat.models import ChatRoom, Message, RoomParticipant

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom JWT token endpoint with additional user data."""

    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    """User registration endpoint."""

    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate tokens for the new user
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "user": UserSerializer(user, context={"request": request}).data,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    """Logout endpoint - blacklists the refresh token."""

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()

            # Set user offline
            request.user.set_offline()

            return Response(
                {"message": "Successfully logged out."}, status=status.HTTP_200_OK
            )
        except TokenError:
            return Response(
                {"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST
            )


class ProfileView(generics.RetrieveUpdateAPIView):
    """User profile view and update endpoint."""

    permission_classes = (IsAuthenticated,)

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return UserUpdateSerializer
        return UserSerializer

    def get_object(self):
        return self.request.user


class PasswordChangeView(APIView):
    """Change password endpoint."""

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        new_passphrase = serializer.validated_data.get("new_passphrase")
        request.user.set_password(serializer.validated_data["new_password"])

        if new_passphrase:
            request.user.set_passphrase(new_passphrase)

        request.user.save()

        return Response(
            {"message": "Password/Passphrase changed successfully."},
            status=status.HTTP_200_OK,
        )


class UserListView(generics.ListAPIView):
    """List all users (for user search)."""

    serializer_class = UserMinimalSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        queryset = User.objects.filter(is_deleted=False).exclude(
            id=self.request.user.id
        )
        search = self.request.query_params.get("search", "")
        if search:
            queryset = queryset.filter(username__icontains=search)
        return queryset[:20]


class UserDetailView(generics.RetrieveAPIView):
    """Get a specific user's public profile."""

    serializer_class = UserSerializer
    permission_classes = (IsAuthenticated,)
    queryset = User.objects.filter(is_deleted=False)


class OnlineUsersView(APIView):
    """Get list of online users."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        online_users = User.objects.filter(is_online=True).exclude(id=request.user.id)
        serializer = UserMinimalSerializer(
            online_users, many=True, context={"request": request}
        )
        return Response(serializer.data)


class DeleteAccountThrottle(throttling.UserRateThrottle):
    """
    Restricts account deletion attempts to reduce the impact of
    compromised credentials, automated abuse, or repeated destructive
    requests against a user account.
    """

    scope = "delete_account"


class DeleteAccountView(APIView):
    """Account deletion endpoint."""

    permission_classes = (IsAuthenticated,)
    throttle_classes = [DeleteAccountThrottle]

    @transaction.atomic
    def delete(self, request):
        serializer = UserDeleteSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        user = request.user

        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except TokenError:
                pass

        if hasattr(user, "set_offline"):
            user.set_offline()

        Message.objects.filter(sender=user).delete()

        direct_rooms = ChatRoom.objects.filter(room_type="direct", participants=user)
        for room in direct_rooms:
            room.messages.all().delete()
            room.delete()

        group_rooms = ChatRoom.objects.filter(
            room_type__in=["group", "subgroup"], participants=user
        ).prefetch_related("room_participants", "messages")
        for room in group_rooms:
            owners = room.room_participants.filter(role="owner")
            is_user_owner = owners.filter(user=user).exists()
            if not is_user_owner:
                RoomParticipant.objects.filter(room=room, user=user).delete()
                continue
            if owners.count() == 1:
                room.messages.all().delete()
                if room.avatar:
                    room.avatar.delete(save=False)
                room.delete()
            else:
                RoomParticipant.objects.filter(room=room, user=user).delete()

        RoomParticipant.objects.filter(user=user).delete()

        user.is_active = False
        user.is_deleted = True
        user.deleted_at = timezone.now()

        user.username = f"deleted_{user.id}_{user.username}"
        if user.email:
            user.email = f"deleted_{user.id}@deleted.local"
        if user.avatar:
            user.avatar.delete(save=False)
        user.save()

        return Response(
            {"message": "Account deleted successfully."}, status=status.HTTP_200_OK
        )
