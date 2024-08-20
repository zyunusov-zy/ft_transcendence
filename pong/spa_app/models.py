from django.db import models
from django.contrib.auth.models import User

def user_directory_path(instance, filename):
	# file will be uploaded to MEDIA_ROOT/user_<id>/<filename>
	return f'user_{instance.user.username}/{filename}'

class UserProfile(models.Model):
	user = models.OneToOneField(User, on_delete=models.CASCADE)
	email_verified = models.BooleanField(default=False)
	profile_picture = models.ImageField(upload_to=user_directory_path, blank=True, null=True)
	reset_token = models.CharField(max_length=64, blank=True, null=True)
	online_status = models.BooleanField(default=False)
	status = models.CharField(max_length=10, choices=[
        ('available', 'Available'),
        ('in_game', 'In Game'),
        ('offline', 'Offline'),
		('online', 'Online'),
    ], default='offline')

	def __str__(self):
		return self.user.username

	def save(self, *args, **kwargs):
		if self.pk:
			try:
				old_profile = UserProfile.objects.get(pk=self.pk)
				if old_profile.profile_picture and old_profile.profile_picture != self.profile_picture:
					old_profile.profile_picture.delete(save=False)
			except UserProfile.DoesNotExist:
				pass
		super().save(*args, **kwargs)


class FriendRequest(models.Model):
	from_user = models.ForeignKey(User, related_name='sent_requests', on_delete=models.CASCADE)
	to_user = models.ForeignKey(User, related_name='received_requests', on_delete=models.CASCADE)
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return f'From {self.from_user.username} to {self.to_user.username}'

class Friendship(models.Model):
	users = models.ManyToManyField(User)
	current_user = models.ForeignKey(User, related_name='owner', null=True, on_delete=models.CASCADE)

	@classmethod
	def make_friend(cls, current_user, new_friend):
		friendship, created = cls.objects.get_or_create(
			current_user=current_user
		)
		friendship.users.add(new_friend)

	@classmethod
	def lose_friend(cls, current_user, new_friend):
		friendship, created = cls.objects.get_or_create(
			current_user=current_user
		)
		friendship.users.remove(new_friend)

class Message(models.Model):
    sender = models.ForeignKey(User, related_name='sent_messages', on_delete=models.CASCADE)
    receiver = models.ForeignKey(User, related_name='received_messages', on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"From {self.sender.username} to {self.receiver.username} ({self.timestamp})"

class GameHistory(models.Model):
    player1 = models.ForeignKey(User, related_name='games_as_player1', on_delete=models.CASCADE)
    player2 = models.ForeignKey(User, related_name='games_as_player2', on_delete=models.CASCADE)
    score_player1 = models.IntegerField()
    score_player2 = models.IntegerField()
    winner = models.ForeignKey(User, related_name='games_won', on_delete=models.CASCADE)
    date_played = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.player1} vs {self.player2} - Winner: {self.winner}"