from django.contrib.auth.forms import UserChangeForm as DjangoUserChangeForm
from django import forms
from django.contrib.auth.hashers import check_password
from django.core.exceptions import ValidationError
from .validators import validate_passphrase
from .models import User


class UserChangeForm(DjangoUserChangeForm):
    new_passphrase = forms.CharField(
        required=False,
        label="New Passphrase",
        widget=forms.PasswordInput(render_value=False),
        help_text="Minimum 16 characters and must not be the same as the account password.",
    )

    class Meta(DjangoUserChangeForm.Meta):
        model = User
        fields = "__all__"

    def clean_new_passphrase(self):
        passphrase = self.cleaned_data.get("new_passphrase")

        if not passphrase:
            return passphrase

        passphrase = passphrase.strip()

        validate_passphrase(passphrase)

        if check_password(passphrase, self.instance.password):
            raise ValidationError(
                "Passphrase cannot be the same as the account password."
            )

        return passphrase

    def save(self, commit=True):
        user = super().save(commit=False)

        passphrase = self.cleaned_data.get("new_passphrase")
        if passphrase:
            user.set_passphrase(passphrase)

        if commit:
            user.save()
            self.save_m2m()

        return user
