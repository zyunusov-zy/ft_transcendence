// function expandEffect(event) {
//     event.preventDefault();
//     fetchFriendsList();
//     document.getElementById('popupContainer').style.display = 'flex';
// 	document.getElementById('overlayF').style.display = 'block';
// }


function closePopup() {
    document.getElementById('popupContainer').style.display = 'none';
	document.getElementById('overlayF').style.display = 'none';
}

async function fetchFriendsList(gameApp) {
    try {
		await ensureValidAccessToken();

        const response = await fetch('/get-friends/');
        const data = await response.json();
        const friendsList = data.friends;
		displayFriendsList(friendsList, gameApp);
    } catch (error) {
        console.error('Error fetching friends list:', error);
    }
}

function displayFriendsList(friendsList, gameApp) {
	const friendsListElement = document.getElementById('friendsList');
	friendsListElement.innerHTML = '';

	if (friendsList.length === 0) {
		friendsListElement.innerHTML = '<li>No friends found</li>';
		return;
	}

	friendsList.forEach(friend => {
		const friendItem = document.createElement('li');
		friendItem.textContent = friend.username;
		friendItem.addEventListener('click', () => {
			gameApp.sendGameRequest(friend.username, 'Do you want to play a game?');
		});
		friendsListElement.appendChild(friendItem);
	});
}