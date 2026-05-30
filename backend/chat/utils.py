"""
Utility functions related to chat performance and data shaping.
"""


def flatten_rooms(rooms, user, depth=0):
    """
    Convert a hierarchical queryset of ChatRoom objects into a flat list.
    """
    flat_list = []
    rooms_list = list(rooms)

    for room in rooms_list:
        flat_list.append({"room": room, "depth": depth})

        subrooms = [
            r
            for r in room.subrooms.all()
            if r.is_active and r.participants.filter(id=user.id).exists()
        ]

        if subrooms:
            flat_list.extend(flatten_rooms(subrooms, user, depth + 1))

    return flat_list
