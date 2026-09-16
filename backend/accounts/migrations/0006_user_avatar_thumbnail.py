from django.db import migrations, models

import accounts.models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0005_userpresence")]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar_thumbnail",
            field=models.ImageField(
                blank=True,
                editable=False,
                null=True,
                upload_to=accounts.models.avatar_thumbnail_upload_to,
            ),
        ),
    ]
