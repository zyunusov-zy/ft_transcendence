const fetchUserData = async () => {
    try {
        await ensureValidAccessToken();


        const response = await fetch('/api/user-data/');
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json();
        displayUserData(data);
    } catch (error) {
        console.error('Error fetching user data:', error);
    }
};

const displayUserData = (data) => {
    const checkElements = () => {
        const nicknameElement = document.querySelector('h5#nickname');
        const avatarElement = document.querySelector('img#avatar');
        
        if (nicknameElement && avatarElement) {
            nicknameElement.textContent = data.nickname;
            avatarElement.src = data.avatar;
        } else {
            setTimeout(checkElements, 100);
        }
    };

    checkElements();
};


function initializeHome() {
    const addFriendLink = document.getElementById('addFriendLink');
    const closeOverlay = document.getElementById('closeOverlay');
    const overlay = document.getElementById('overlay');
    const addFriendButton = document.getElementById('addFriendButton');
    const friendNameInput = document.getElementById('FriendName');
    const friendsBox = document.getElementById('friendsBox');
    const incomingRequestsBox = document.getElementById('incomingRequests');
    const requestsLink = document.getElementById('requestsLink');
    const historyLink =  document.getElementById('historyLink');
    const playLink = document.getElementById('playLink');
    
    if ( !historyLink ||!addFriendLink || !closeOverlay || !overlay || !addFriendButton || !incomingRequestsBox 
        || !friendNameInput || !friendsBox || !requestsLink) {
            console.error('Home page elements not found');
            return;
        }
    const globApp = new GlobApp();
    globApp.init();
    addFriendLink.addEventListener('click', (event) => {
        event.preventDefault();
        overlay.style.display = 'block';
    });

    closeOverlay.addEventListener('click', () => {
        overlay.style.display = 'none';
    });

    addFriendButton.addEventListener('click', async () => {
        const friendName = friendNameInput.value;
    
        const requestBody = JSON.stringify({ to_user_username: friendName });
        
        await ensureValidAccessToken();
        // Send the request
        const response = await fetch('/send-friend-request/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: requestBody,
        });
    
        // Log the response
        const responseClone = response.clone();
        const responseText = await responseClone.text();
    
        const result = await response.json();
        if (result.success) {
            alert('Friend request sent');
            overlay.style.display = 'none';
            friendNameInput.value = '';
        } else {
            alert(result.message);
        }
    });

    async function loadRequests() {
        await ensureValidAccessToken();

        const response = await fetch('/get-friend-requests/', {
            method: 'GET',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
            }
        });
    
        if (response.redirected) {
            window.location.href = response.url;
            return;
        }
    
        const result = await response.json();

        incomingRequestsBox.innerHTML = '';
        result.received_requests.forEach(request => {
            const requestElem = document.createElement('div');
            requestElem.classList.add('friend-request');
    
            const nickname = document.createElement('span');
            nickname.classList.add('nickname');
            nickname.textContent = `${request.from_user}`;
    
            const actionsContainer = document.createElement('div');
            actionsContainer.classList.add('actions-container');
    
            const acceptLink = document.createElement('a');
            acceptLink.href = '#';
            acceptLink.classList.add('action-link', 'accept-link');
            acceptLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="green" width="24" height="24"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm-1.41 17.41l-5-5a.996.996 0 1 1 1.41-1.41L11 14.59l6.29-6.29a.996.996 0 1 1 1.41 1.41l-7 7a.996.996 0 0 1-1.41 0z"/></svg>`;
            acceptLink.addEventListener('click', (event) => {
                event.preventDefault();
                handleAcceptRequest(request.id);
            });
    
            const rejectLink = document.createElement('a');
            rejectLink.href = '#';
            rejectLink.classList.add('action-link', 'reject-link');
            rejectLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red" width="24" height="24"><path d="M0 0h24v24H0z" fill="none"/><path d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z"/></svg>`;
            rejectLink.addEventListener('click', (event) => {
                event.preventDefault();
                handleRejectRequest(request.id);
            });
    
            actionsContainer.appendChild(acceptLink);
            actionsContainer.appendChild(rejectLink);
    
            requestElem.appendChild(nickname);
            requestElem.appendChild(actionsContainer);
    
            incomingRequestsBox.appendChild(requestElem);
        });
    }
    
    async function loadFriends() {
        await ensureValidAccessToken();

        const response = await fetch('/get-friends/', {
            method: 'GET',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
            }
        });
    
        if (response.redirected) {
            window.location.href = '';
            return;
        }
    
        const result = await response.json();
        friendsBox.innerHTML = '';
        result.friends.forEach(friend => {
            const friendElem = document.createElement('div');
            friendElem.classList.add('friend-mini-box');
    
            const nickname = document.createElement('span');
            nickname.textContent = friend.username;
            nickname.setAttribute('id', `nick`);

            const statusIcon = document.createElement('span');
            statusIcon.classList.add('status-icon');
            
            if (friend.status === 'online') {
                statusIcon.innerHTML = '<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--noto" preserveAspectRatio="xMidYMid meet" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><circle cx="63.93" cy="64" r="60" fill="#689f38"></circle><circle cx="60.03" cy="63.1" r="56.1" fill="#7cb342"></circle><path d="M23.93 29.7c4.5-7.1 14.1-13 24.1-14.8c2.5-.4 5-.6 7.1.2c1.6.6 2.9 2.1 2 3.8c-.7 1.4-2.6 2-4.1 2.5a44.64 44.64 0 0 0-23 17.4c-2 3-5 11.3-8.7 9.2c-3.9-2.3-3.1-9.5 2.6-18.3z" fill="#aed581"></path></g></svg>';
            } else if (friend.status === 'offline') {
                statusIcon.innerHTML = '<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--noto" preserveAspectRatio="xMidYMid meet" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><circle cx="63.93" cy="64" r="60" fill="#c33"></circle><circle cx="60.03" cy="63.1" r="56.1" fill="#f44336"></circle><path d="M23.93 29.7c4.5-7.1 14.1-13 24.1-14.8c2.5-.4 5-.6 7.1.2c1.6.6 2.9 2.1 2 3.8c-.7 1.4-2.6 2-4.1 2.5a44.64 44.64 0 0 0-23 17.4c-2 3-5 11.3-8.7 9.2c-3.9-2.3-3.1-9.5 2.6-18.3z" fill="#ff8a80"></path></g></svg>';
            } else if (friend.status === 'in_game') {
                statusIcon.innerHTML = '<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" fill="#1E88E5"><circle cx="64" cy="64" r="60" fill="#42A5F5"></circle><circle cx="64" cy="64" r="56" fill="#90CAF9"></circle></svg>';            
            }else if ( friend.status === 'available'){
                statusIcon.innerHTML = '<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--noto" preserveAspectRatio="xMidYMid meet" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><circle cx="63.93" cy="64" r="60" fill="#689f38"></circle><circle cx="60.03" cy="63.1" r="56.1" fill="#7cb342"></circle><path d="M23.93 29.7c4.5-7.1 14.1-13 24.1-14.8c2.5-.4 5-.6 7.1.2c1.6.6 2.9 2.1 2 3.8c-.7 1.4-2.6 2-4.1 2.5a44.64 44.64 0 0 0-23 17.4c-2 3-5 11.3-8.7 9.2c-3.9-2.3-3.1-9.5 2.6-18.3z" fill="#aed581"></path></g></svg>';
            }
            const chatIcon = document.createElement('span');
            chatIcon.classList.add('chat-icon');
            chatIcon.innerHTML = '&#x1F4AC;';
            chatIcon.addEventListener('click', () => openChatBox(friend.username, globApp));

            friendElem.appendChild(statusIcon);
            friendElem.appendChild(nickname);
            friendElem.appendChild(chatIcon);

            friendsBox.appendChild(friendElem);
        });
    }
    async function handleAcceptRequest(requestId) {
        await ensureValidAccessToken();
		const str = getCookie('csrftoken');
        const response = await fetch(`/accept-friend-request/${requestId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            }
        });
    
        const result = await response.json();
        if (result.success) {
            alert('Friend request accepted');
            loadRequests();
            loadFriends();
        } else {
            alert(result.message);
        }
    }
    
    async function handleRejectRequest(requestId) {
        await ensureValidAccessToken();
        const response = await fetch(`/reject-friend-request/${requestId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            }
        });
    
        const result = await response.json();
        if (result.success) {
            alert('Friend request rejected');
            loadRequests();
        } else {
            alert(result.message);
        }
    }
    // attachEventListeners();
    
    document.getElementById('friendsLink').addEventListener('click', (event) => {
        event.preventDefault();
        
        document.querySelector('.friends-box').style.display = 'flex';
        document.querySelector('.chats-box').style.display = 'none';
        document.querySelector('.request-box').style.display = 'none';
    
        loadFriends();
    });
    
    
    document.getElementById('requestsLink').addEventListener('click', (event) => {
        event.preventDefault();
    
        document.querySelector('.request-box').style.display = 'flex';
        document.querySelector('.chats-box').style.display = 'none';
        document.querySelector('.friends-box').style.display = 'none';
    
        loadRequests();
    });

    function Status() {
        const onlineButton = document.getElementById('onlineButton');
        const offlineButton = document.getElementById('offlineButton');
        const statusSpan = document.querySelector('.status-dropdown > span');

        
        if(!onlineButton || !offlineButton)
            return;

        async function updateStatusOnServer(status) {
            await ensureValidAccessToken();

            fetch('/update-status/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({ status: status })
            })
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error('Network response was not ok.');
                }
            })
            .then(data => {
            })
            .catch(error => {
                console.error('Error updating status:', error);
            });
        }

        onlineButton.addEventListener('click', function(event) {
            event.preventDefault(); 
            statusSpan.innerHTML = 'Online';
            statusSpan.innerHTML += '<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--noto" preserveAspectRatio="xMidYMid meet" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><circle cx="63.93" cy="64" r="60" fill="#689f38"></circle><circle cx="60.03" cy="63.1" r="56.1" fill="#7cb342"></circle><path d="M23.93 29.7c4.5-7.1 14.1-13 24.1-14.8c2.5-.4 5-.6 7.1.2c1.6.6 2.9 2.1 2 3.8c-.7 1.4-2.6 2-4.1 2.5a44.64 44.64 0 0 0-23 17.4c-2 3-5 11.3-8.7 9.2c-3.9-2.3-3.1-9.5 2.6-18.3z" fill="#aed581"></path></g></svg>';
            updateStatusOnServer('online');
        });
    
        offlineButton.addEventListener('click', function(event) {
            event.preventDefault(); 
            statusSpan.innerHTML = 'Offline';
		    statusSpan.innerHTML += '<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--noto" preserveAspectRatio="xMidYMid meet" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><circle cx="63.93" cy="64" r="60" fill="#c33"></circle><circle cx="60.03" cy="63.1" r="56.1" fill="#f44336"></circle><path d="M23.93 29.7c4.5-7.1 14.1-13 24.1-14.8c2.5-.4 5-.6 7.1.2c1.6.6 2.9 2.1 2 3.8c-.7 1.4-2.6 2-4.1 2.5a44.64 44.64 0 0 0-23 17.4c-2 3-5 11.3-8.7 9.2c-3.9-2.3-3.1-9.5 2.6-18.3z" fill="#ff8a80"></path></g></svg>';
            updateStatusOnServer('offline');
        });
    }

    historyLink.addEventListener('click', async function(e) {
        // History
        e.preventDefault();
        document.querySelector('.play-box').style.display = 'none';
        document.querySelector('.history-box').style.display = 'flex';
    
        await ensureValidAccessToken();

        fetch('/api/game-history/')
        .then(response => response.json())
        .then(data => {
            const historyBox = document.getElementById('historyBox');
            historyBox.innerHTML = '';
    
            data.history.forEach(game => {
                const gameRecord = document.createElement('div');
                gameRecord.classList.add('game-record');
                
                const player1Class = game.player1 === game.winner ? 'winner' : 'loser';
                const player2Class = game.player2 === game.winner ? 'winner' : 'loser';
    
                gameRecord.innerHTML = `
                    <div class="game-header">
                        <div class="game-date">${game.date_played}</div>
                    </div>
                    <div class="game-details">
                        <div class="player player-left ${player1Class}">${game.player1} (${game.score_player1})</div>
                        <div class="game-score">vs</div>
                        <div class="player player-right ${player2Class}">${game.player2} (${game.score_player2})</div>
                    </div>
                `;
                historyBox.appendChild(gameRecord);
            });
        })
        .catch(error => console.error('Error loading game history:', error));
    });

    playLink.addEventListener('click', function(e){
        e.preventDefault();
        document.querySelector('.play-box').style.display = 'flex';
        document.querySelector('.history-box').style.display = 'none';
    })
    
    document.getElementById('PlayWithFriendButton').addEventListener("click", function(event) {
        event.preventDefault();
        fetchFriendsList(globApp);
        document.getElementById('popupContainer').style.display = 'flex';
	    document.getElementById('overlayF').style.display = 'block';
    });

    document.getElementById('PlayWithFriendSameButton').addEventListener("click", function(event) {
        event.preventDefault();
        

        document.getElementById('opponentFormContainer').style.display = 'flex';
    });
    
    document.getElementById('opponentForm').addEventListener('submit', function(event) {
        event.preventDefault();
        
        const opponentUsername = document.getElementById('opponent_username').value;
        const own = document.getElementById('own_username').value;

        const gameAppS = new GameAPPS(own, opponentUsername, 0);
        gameAppS.init();
        
        document.getElementById('opponentFormContainer').style.display = 'none';
    });

    document.getElementById('closeFormButton').addEventListener('click', function() {
        document.getElementById('opponentFormContainer').style.display = 'none';
    });

    let firstLinkF = document.querySelector('.side-links a:first-child');
    if (firstLinkF) {
        addBorder(firstLinkF);
    }

    let firstLinkG = document.querySelector('.game-links a:first-child');
    if (firstLinkG) {
        addBorderM(firstLinkG);
    }

    document.querySelectorAll('.side-links a').forEach(function(link) {
        link.addEventListener('click', function() {
            addBorder(this);
        });
    });
    
    document.querySelectorAll('.game-links a').forEach(function(link) {
        link.addEventListener('click', function() {
            addBorderM(this);
        });
    });

    document.getElementById('logoutBtn').addEventListener('click', (event) => {
        event.preventDefault();
        handleLogout(globApp);
    });

    const tournament = new Tournament();
    document.getElementById('tournamentBtn').addEventListener('click', (event) => {
        event.preventDefault();
        tournament.openModal('numberOfPlayersModal');
    });


    const closeM =  document.getElementById('closePlayersModalBtn');
    const closeM2 = document.getElementById('closePlayerFormModalBtn');
    const submitPlayersBtn = document.getElementById('submitPlayersBtn');
    if(!closeM || !closeM2 || !submitPlayersBtn)
        return;
    document.getElementById('closePlayersModalBtn').addEventListener('click', () => {
        tournament.closeModal('numberOfPlayersModal');
    });

    document.getElementById('submitPlayersBtn').addEventListener('click', () => {
        tournament.generatePlayerInputs();
    });

    document.getElementById('closePlayerFormModalBtn').addEventListener('click', () => {
        tournament.closeModal('playerFormModal');
    });


    const toggleBtn = document.getElementById('toggleBtn');
    const extraInputField = document.getElementById('extraInputField');
    const submitExtraInput = document.getElementById('submitExtraInput');
    const messageDiv = document.getElementById('error-message');

    if (!toggleBtn || !extraInputField || !submitExtraInput) return;

    toggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
    
        if (toggleBtn.classList.contains('disabled')) {
            toggleBtn.classList.remove('disabled');
            toggleBtn.classList.add('enabled');
            toggleBtn.textContent = 'Disable';
    
            fetch2fa(extraInputField, submitExtraInput);
        } else {
            toggleBtn.classList.remove('enabled');
            toggleBtn.classList.add('disabled');
            toggleBtn.textContent = 'Enable'; 
            
            fetchDisable2fa(extraInputField, submitExtraInput);
        }
    });
    
    Status();
    loadFriends();
}


async function fetch2fa(extraInputField, submitExtraInput)
{
    const messageDiv = document.getElementById('error-message');
    await ensureValidAccessToken();
    fetch('/enable-2fa/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify({ enable_2fa: true }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            extraInputField.style.display = 'block';
            submitExtraInput.style.display = 'block';
            messageDiv.textContent = '2FA code sent to your email!';
        } else {
            messageDiv.textContent = 'Error sending 2FA code. Please try again.';
        }
    });

    const extraIn = document.getElementById('extraInput');
    submitExtraInput.addEventListener('click', async function(e) {
        e.preventDefault();
        
        const code = extraIn.value.trim(); 
        
        if (!code) {
            messageDiv.textContent = 'Please enter the 2FA code.';
            return;
        }
        await ensureValidAccessToken();
        fetch('/verify-2fa/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({ code: code }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                messageDiv.textContent = '2FA enabled successfully!';
            } else {
                messageDiv.textContent = 'Invalid or expired code. Please try again.';
            }
        })
        .catch(error => {
            console.error('Fetch error:', error);
            messageDiv.textContent = 'Error verifying the 2FA code. Please try again.';
        });
    });
}

async function fetchDisable2fa(extraInputField, submitExtraInput) {
    const messageDiv = document.getElementById('error-message');

    await ensureValidAccessToken();

    fetch('/request-disable-2fa-code/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            messageDiv.textContent = '2FA disable code sent to your email!';
        } else {
            messageDiv.textContent = 'Error sending 2FA disable code. Please try again.';
        }
    })
    .catch(error => {
        console.error('Fetch error:', error);
        messageDiv.textContent = 'Error sending the disable 2FA code. Please try again.';
    });

    const extraIn = document.getElementById('extraInput');
    submitExtraInput.addEventListener('click', async function(e) {
        e.preventDefault();

        const code = extraIn.value.trim();

        if (!code) {
            messageDiv.textContent = 'Please enter the 2FA disable code.';
            return;
        }
        await ensureValidAccessToken();
        fetch('/verify-disable-2fa/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({ code: code }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                messageDiv.textContent = '2FA has been disabled successfully!';
            } else {
                messageDiv.textContent = 'Invalid or expired code. Please try again.';
            }
        })
        .catch(error => {
            console.error('Fetch error:', error);
            messageDiv.textContent = 'Error verifying the disable 2FA code. Please try again.';
        });
    });
}



function addBorder(element) {
    var links = document.querySelectorAll('.side-links a');
    links.forEach(function(link) {
        link.style.borderBottom = 'none';
        link.style.color = 'white';
    });

    element.style.borderBottom = '2px solid white';
    element.style.color = '#C33149';
}

function addBorderM(element)
{
	var linksm = document.querySelectorAll('.game-links a');
	linksm.forEach(function(link) {
        link.style.borderBottom = 'none';
		link.style.color = '#100C4F';
    });

	element.style.borderBottom = '2px solid white';
	element.style.color = 'white';
}



function attachEventListeners() {
    function showBox(boxToShow) {
        const boxes = ['friends-box', 'chats-box', 'request-box'];
        boxes.forEach(box => {
            document.querySelector(`.${box}`).style.display = box === boxToShow ? 'flex' : 'none';
        });
    }

    const friendsLink = document.getElementById('friendsLink');
    const requestsLink = document.getElementById('requestsLink');

    if (friendsLink) {
        friendsLink.addEventListener('click', (event) => {
            event.preventDefault();
            showBox('friends-box');
            loadFriends();
        });
    }

    if (requestsLink) {
        requestsLink.addEventListener('click', (event) => {
            event.preventDefault();
            showBox('request-box');
            loadRequests();
        });
    }
}
