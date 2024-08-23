function switchToChatBox() {
    document.querySelector('.chats-box').style.display = 'flex';
}

let chatSockets = {};

function openChatBox(friend, globApp) {
    let chatBox = document.getElementById(`chat-box-${friend}`);
    let background = document.getElementById('chatBoxBackground');

    if (!chatBox) {
        chatBox = createChatBox(friend, globApp);
    }

    // Open the chat box and show the background
    chatBox.classList.add('active');
    background.classList.add('active');

    // Fetch and display previous messages
    fetchMessages(friend);

    // Establish WebSocket connection if not already connected
    if (!chatSockets[friend]) {
        establishWebSocketConnection(friend);
    }

    if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission !== 'granted') {
                console.warn('Notification permission not granted.');
            }
        });
    }
}

function createChatBox(friend, globApp) {
    const chatContainer = document.getElementById('chatsBox');

    const chatBox = document.createElement('div');
    chatBox.id = `chat-box-${friend}`; // Fixed ID attribute
    chatBox.className = 'chat-box';

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.className = 'close-button';
    closeButton.addEventListener('click', () => {
        closeChatBox(friend);
    });
    chatBox.appendChild(closeButton);

    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'messages';
    chatBox.appendChild(messagesContainer);

    const inputContainer = document.createElement('div');
    inputContainer.className = 'input-container';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type a message...';
    input.className = 'message-input';
    inputContainer.appendChild(input);

    const sendButton = document.createElement('button');
    sendButton.innerText = 'Send';
    sendButton.className = 'send-button';
    sendButton.addEventListener('click', () => sendMessage(friend));
    inputContainer.appendChild(sendButton);

    const ellipsisButton = document.createElement('button');
    ellipsisButton.innerHTML = '&#x2026;'; // Unicode for vertical ellipsis
    ellipsisButton.className = 'ellipsis-button';

    // Dropdown menu container
    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'dropdown-menu';
    dropdownMenu.id = 'dropdownMenu';
    dropdownMenu.style.display = 'none'; // Initially hidden

    // Dropdown menu options
    const blockOption = document.createElement('div');
    blockOption.innerText = 'Block';
    blockOption.className = 'dropdown-option';
    blockOption.addEventListener('click', () => {
        blockUser(friend, blockOption)
    });

    const profileOption = document.createElement('div');
    profileOption.innerText = 'Profile';
    profileOption.className = 'dropdown-option';
    profileOption.addEventListener('click', () => {
        viewProfile(friend)
    });

    const playOption = document.createElement('div');
    playOption.innerText = 'Play';
    playOption.className = 'dropdown-option';
    playOption.addEventListener('click', () => {
        playGame(friend, globApp)
    });

    dropdownMenu.appendChild(blockOption);
    dropdownMenu.appendChild(profileOption);
    dropdownMenu.appendChild(playOption);

    ellipsisButton.addEventListener('click', () => {
        dropdownMenu.style.display = dropdownMenu.style.display === 'none' || dropdownMenu.style.display === '' ? 'block' : 'none';
    });

    inputContainer.appendChild(ellipsisButton);

    inputContainer.appendChild(dropdownMenu);

    chatBox.appendChild(inputContainer);
    chatContainer.appendChild(chatBox);

    switchToChatBox(); // Make sure this function is defined elsewhere

    return chatBox;
}

function blockUser(friend, blockOption) {
    console.log(`Viewing profile of ${friend}`);
}

// Function to view user's profile
function viewProfile(friend) {
    let dropMen = document.getElementById('dropdownMenu');
    dropMen.style.display = 'none';
    let mainP = document.getElementById('mainPage');
    let profileBox = document.getElementById('profileBox');
    if (!profileBox) {
        profileBox = document.createElement('div');
        profileBox.id = 'profileBox';
        profileBox.className = 'profile-box';
        console.log(profileBox);
        mainP.appendChild(profileBox);
    }
    fetch(`/api/friend-profile/${friend}/`)
        .then(response => response.json())
        .then(friend => {
            profileBox.innerHTML = '';

            const closeButton = document.createElement('button');
            closeButton.className = 'close-btn';
            closeButton.innerHTML = `
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#000000" width="24" height="24">
                    <path fill="none" d="M0 0h24v24H0z"/>
                    <path d="M18.3 5.71a1 1 0 00-1.42-1.42L12 9.59 7.12 4.71a1 1 0 10-1.42 1.42L10.59 12l-4.88 4.88a1 1 0 101.42 1.42L12 14.41l4.88 4.88a1 1 0 001.42-1.42L13.41 12l4.88-4.88z"/>
                </svg>
            `;
            closeButton.onclick = () => {
                profileBox.style.display = 'none'; // Hide the profile box when clicked
            };
            profileBox.appendChild(closeButton);


            const mainTop = document.createElement('div');
            mainTop.className = 'main-topP';

            // Create game-info container
            const gameInfo = document.createElement('div');
            gameInfo.className = 'game-infoP';

            // Create game-links container
            const gameLinks = document.createElement('div');
            gameLinks.className = 'game-links';

            // Create history link
            const historyLink = document.createElement('a');
            historyLink.id = 'historyLink';
            historyLink.className = 'text-decoration-none';
            historyLink.href = '#';
            historyLink.textContent = 'History';

            // Append history link to game-links
            gameLinks.appendChild(historyLink);

            // Append game-links to game-info
            gameInfo.appendChild(gameLinks);

            // Append game-info to main-top
            mainTop.appendChild(gameInfo);

            // Create person-info container
            const personInfo = document.createElement('div');
            personInfo.className = 'person-infoP';

            // Create player-status container
            const playerStatus = document.createElement('div');
            playerStatus.className = 'player-status';

            // Create nickname element
            const nickname = document.createElement('h5');
            nickname.id = 'nickname';
            nickname.textContent = friend.nickname;

            // Create status-dropdown container
            const statusDropdown = document.createElement('div');
            statusDropdown.className = 'status-dropdown';

            let statusIcon = '';
            const newStatus = friend.status || 'offline'; // Default to 'offline' if no status

            if (newStatus === 'online') {
                statusIcon = `
                    <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img" class="iconify iconify--noto" preserveAspectRatio="xMidYMid meet" fill="#000000">
                        <circle cx="63.93" cy="64" r="60" fill="#689f38"></circle>
                        <circle cx="60.03" cy="63.1" r="56.1" fill="#7cb342"></circle>
                        <path d="M23.93 29.7c4.5-7.1 14.1-13 24.1-14.8c2.5-.4 5-.6 7.1.2c1.6.6 2.9 2.1 2 3.8c-.7 1.4-2.6 2-4.1 2.5a44.64 44.64 0 0 0-23 17.4c-2 3-5 11.3-8.7 9.2c-3.9-2.3-3.1-9.5 2.6-18.3z" fill="#aed581"></path>
                    </svg>`;
            } else if (newStatus === 'offline') {
                statusIcon = `
                    <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img" class="iconify iconify--noto" preserveAspectRatio="xMidYMid meet" fill="#000000">
                        <circle cx="63.93" cy="64" r="60" fill="#c33"></circle>
                        <circle cx="60.03" cy="63.1" r="56.1" fill="#f44336"></circle>
                        <path d="M23.93 29.7c4.5-7.1 14.1-13 24.1-14.8c2.5-.4 5-.6 7.1.2c1.6.6 2.9 2.1 2 3.8c-.7 1.4-2.6 2-4.1 2.5a44.64 44.64 0 0 0-23 17.4c-2 3-5 11.3-8.7 9.2c-3.9-2.3-3.1-9.5 2.6-18.3z" fill="#ff8a80"></path>
                    </svg>`;
            } else if (newStatus === 'in_game') {
                statusIcon = `
                    <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" fill="#1E88E5">
                        <circle cx="64" cy="64" r="60" fill="#42A5F5"></circle>
                        <circle cx="64" cy="64" r="56" fill="#90CAF9"></circle>
                    </svg>`;
            } else if (newStatus === 'available') {
                statusIcon = `
                    <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img" class="iconify iconify--noto" preserveAspectRatio="xMidYMid meet" fill="#000000">
                        <circle cx="63.93" cy="64" r="60" fill="#689f38"></circle>
                        <circle cx="60.03" cy="63.1" r="56.1" fill="#7cb342"></circle>
                        <path d="M23.93 29.7c4.5-7.1 14.1-13 24.1-14.8c2.5-.4 5-.6 7.1.2c1.6.6 2.9 2.1 2 3.8c-.7 1.4-2.6 2-4.1 2.5a44.64 44.64 0 0 0-23 17.4c-2 3-5 11.3-8.7 9.2c-3.9-2.3-3.1-9.5 2.6-18.3z" fill="#aed581"></path>
                    </svg>`;
            }

            // Append the status and icon to the statusDropdown
            statusDropdown.innerHTML = `
                <span>
                    ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)} 
                    ${statusIcon}
                </span>`;

            // Append nickname and status-dropdown to player-status
            playerStatus.appendChild(nickname);
            playerStatus.appendChild(statusDropdown);

            // Append player-status to person-info
            personInfo.appendChild(playerStatus);

            // Create and append avatar image
            const avatar = document.createElement('img');
            avatar.id = 'avatar';
            avatar.alt = 'Player Avatar';
            avatar.src = friend.avatar;
            personInfo.appendChild(avatar);

            // Append person-info to main-top
            mainTop.appendChild(personInfo);

            // Append main-top to profileBox
            profileBox.appendChild(mainTop);

            // Create and append history-box container
            const historyBox = document.createElement('div');
            historyBox.className = 'history-boxP';
            historyBox.id = 'historyBox';

            friend.history.forEach(game => {
                const gameRecord = document.createElement('div');
                gameRecord.classList.add('game-recordP');
            
                // Determine the classes based on the winner
                const player1Class = game.player1 === game.winner ? 'winner' : 'loser';
                const player2Class = game.player2 === game.winner ? 'winner' : 'loser';
            
                // Create the inner HTML structure for each game record
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
            
                // Append each game record to the history box
                historyBox.appendChild(gameRecord);
            });

            // Append history-box to profileBox
            profileBox.appendChild(historyBox);

            profileBox.style.display = 'block';
        })
        .catch(error => {
            console.error('Error fetching profile:', error);
        });
}

// Function to start a game with the user
function playGame(friend, globApp) {
    let dropMen = document.getElementById('dropdownMenu');
    dropMen.style.display = 'none';
    console.log("GAME REQ SENT");
    console.log(globApp);
    globApp.sendGameRequest(friend, 'Do you want to play a game?');
}


async function fetchMessages(friend) {
    const response = await fetch(`/api/messages/${friend}/`);
    const messages = await response.json();
    const chatBox = document.getElementById(`chat-box-${friend}`);
    const messagesContainer = chatBox.querySelector('.messages');

    messagesContainer.innerHTML = '';


    console.log(messages);
    messages.forEach(message => {
        const messageElement = document.createElement('div');
        if (message.sender === friend) {
            messageElement.className = 'message friend-message';
        } else {
            messageElement.className = 'message my-message';
        }
        messageElement.innerHTML = `<strong>${message.sender}:</strong> ${message.content}`;
        messagesContainer.appendChild(messageElement);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight; // Auto scroll to bottom
}

function sendMessage(friend) {
    const chatBox = document.getElementById(`chat-box-${friend}`);
    const input = chatBox.querySelector('.message-input');
    const messageContent = input.value;

    if (messageContent.trim() === '') return;

    const message = {
        recipient_username: friend,
        content: messageContent
    };

    // Send the message via WebSocket
    if (chatSockets[friend]) {
        console.log("HEEEEEEEWWWWWWWWWW");
        chatSockets[friend].send(JSON.stringify({
            'message': messageContent
        }));
    } else {
        // Fallback to HTTP POST if WebSocket is not available
        fetch('/api/message/send/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') // Ensure you pass the CSRF token correctly
            },
            body: JSON.stringify(message)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Message sent:', data);
            input.value = '';
        })
        .catch(error => console.error('Error sending message:', error));
    }
    input.value = '';
}


function establishWebSocketConnection(friend) {
    const socket = new WebSocket(`ws://${window.location.host}/ws/chat/${friend}/`);

    socket.onopen = function(event) {
        console.log('WebSocket connection opened:', event);
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        const message = data['message'];
        const sender = data['sender'];
        console.log('Message received:', data); // Add this line for debugging
        displayIncomingMessage(friend, message, sender);

        if (document.hidden || !chatBoxVisible(friend)) {
            showNotification(`New message from ${sender}`, message);
        }
    };


    socket.onclose = function(event) {
        console.log('WebSocket connection closed:', event);
        delete chatSockets[friend];
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };

    chatSockets[friend] = socket;
}

function displayIncomingMessage(friend, message, sender) {
    const chatBox = document.getElementById(`chat-box-${friend}`);
    if (!chatBox) {
        console.error(`Chat box for ${friend} not found.`); // Add this line for debugging
        return;
    }
    const messagesContainer = chatBox.querySelector('.messages');

    const messageElement = document.createElement('div');
    if (sender === friend) {
        messageElement.className = 'message friend-message';
    } else {
        messageElement.className = 'message my-message';
    }
    messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
    messagesContainer.appendChild(messageElement);

    messagesContainer.scrollTop = messagesContainer.scrollHeight; // Auto scroll to bottom
}

function showNotification(title, message) {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: 'path/to/icon.png' // Optional: path to an icon image
        });
    }
}

function chatBoxVisible(friend) {
    const chatBox = document.getElementById(`chat-box-${friend}`);
    return chatBox && chatBox.style.display !== 'none';
}

function closeChatBox(friend) {
    const chatBox = document.getElementById(`chat-box-${friend}`);
    const background = document.getElementById('chatBoxBackground');

    if (chatBox) {
        chatBox.classList.remove('active');
        chatBox.remove(); // Remove the chat box from the DOM
    }

    // Hide the shadowed background
    background.classList.remove('active');
    document.querySelector('.chats-box').style.display = 'none';

}

const getCookies = (name) => {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
};