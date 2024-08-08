class Player {
    constructor(username, side) {
        this.username = username;
        this.side = side;
        this.score = 0;
        this.winner = 0;
    }

    updateScore(newScore) {
        this.score = newScore;
    }
}

class GameApp {
    constructor() {
        this.globalSocket = null;
        this.gameSocket = null;
        this.assignedSide = null;

        this.keyState = {
            left: { up: false, down: false },
            right: { up: false, down: false }
        };
        this.lastBallUpdateTime = null;
        this.players = {};
        this.scene = null;
        this.tableMaterial = null;
        this.tableGeometry = null;
        this.table = null;

        this.tableW = 1200;
        this.tableH = 75;
        this.tableD = 600;

        this.racketMaterial = null;
        this.racketGeometry = null;
        this.racket = null;
        this.rRacketMaterial = null;
        this.rRacketGeometry = null;
        this.rRacket = null;

        this.racketW = 20;
        this.racketH = 100;
        this.racketD = 100;

        this.ballGeometry = null;
        this.ballMaterial = null;
        this.ball = null;
        this.ballVelocity = new THREE.Vector3(4, 0, 4);
        this.camera = null;
        this.renderer = null;
        this.ambientLight = null;
        this.directionalLight = null;
        this.gridHelper = null;
        this.axesHelper = null;

        this.tablePosZ = -150;
        this.ballRadius = 15;
        this.halfRacketHeight = this.racketH / 2; // Corrected reference to this.racketH

        // Initialize tableProp after defining other properties
        this.tableProp = {
            minZ: this.tablePosZ - this.tableD / 2 + this.ballRadius,
            maxZ: this.tablePosZ + this.tableD / 2 - this.ballRadius,
            minX: -this.tableW / 2, // Fixed syntax issue
            maxX: this.tableW / 2
        };

        this.animationFrameId = null;
        this.gameRunning = true; 
    }



    GlobSocket() {
        this.globalSocket = new WebSocket(`ws://${window.location.host}/ws/global/`);

        this.globalSocket.onopen = () => {
            console.log('Global WebSocket connection established');
        };

        this.globalSocket.onmessage = (e) => {
            console.log('Message received:', e.data);

            const data = JSON.parse(e.data);
            if (data.type === 'notification') {
                alert('New message from your friend: ' + data.message);
            } else if (data.type === 'game_request') {
                console.log("REQUEST GOTTT");
                this.displayGameRequest(data.sender_id, data.sender_username, data.game_request);
            } else if (data.type === 'game_response') {
                alert('Game request ' + data.response + ' by ' + data.responder_username);
                if (data.response === 'accepted') {
                    console.log("Game request accepted");
                    this.gameVis(data.responder_username);
                }
            }
        };

        this.globalSocket.onerror = (e) => {
            console.error('WebSocket error:', e);
        };

        this.globalSocket.onclose = (e) => {
            console.error('Global socket closed unexpectedly:', e);
        };
    }

    sendGameRequest(receiverUsername, gameRequest) {
        if (this.globalSocket && this.globalSocket.readyState === WebSocket.OPEN) {
            this.globalSocket.send(JSON.stringify({
                'receiver_username': receiverUsername,
                'game_request': gameRequest,
            }));
            console.log('Game request sent:', { receiverUsername, gameRequest });
        } else {
            console.error('Global WebSocket is not open. Cannot send game request.');
        }
    }

    sendGameResponse(receiverId, response) {
        if (this.globalSocket && this.globalSocket.readyState === WebSocket.OPEN) {
            this.globalSocket.send(JSON.stringify({
                'receiver_id': receiverId,
                'response': response,
            }));
            console.log('Game response sent:', { receiverId, response });
        } else {
            console.error('Global WebSocket is not open. Cannot send game response.');
        }
    }

    displayGameRequest(senderId, senderUsername, gameRequest) {
        const overlay = document.createElement('div');
        overlay.id = 'gameRequestOverlay';
        
        const gameRequestContainer = document.createElement('div');
        gameRequestContainer.id = 'gameRequestContainer';
        gameRequestContainer.innerHTML = `
            <p>${senderUsername} wants to play a game: ${gameRequest}</p>
            <button id="acceptGameRequest">Accept</button>
            <button id="rejectGameRequest">Reject</button>
        `;
        
        overlay.appendChild(gameRequestContainer);
        document.body.appendChild(overlay);

        document.getElementById('acceptGameRequest').addEventListener('click', () => {
            this.sendGameResponse(senderId, 'accepted');
            document.body.removeChild(overlay);
            this.gameVis(senderUsername);
        });

        document.getElementById('rejectGameRequest').addEventListener('click', () => {
            this.sendGameResponse(senderId, 'rejected');
            document.body.removeChild(overlay);
        });
    }

    gameVis(friendUsername) {
        document.getElementById('gameCon').style.display = 'block';
        document.getElementById('sideBar').style.display = 'none';
        document.getElementById('mainPageHome').style.display = 'none';
        this.GameSocket(friendUsername);
        
        const scoreboard = document.createElement('div');
        scoreboard.innerHTML = `
        <div id="scoreboard">
            <div id="player1">
                <span id="player1-name"></span>
            </div>
            <div id="score-center">
                <span id="player1-score"></span> - <span id="player2-score"></span>
            </div>
            <div id="player2">
                <span id="player2-name"></span>
            </div>
        </div>
        `;
        document.getElementById('gameCon').appendChild(scoreboard);
        
        this.initGame(); // Run the game when the request is accepted
    }

    GameSocket(friendUsername) {
        const wsPath = `ws://${window.location.host}/ws/game/${friendUsername}/`;

        this.gameSocket = new WebSocket(wsPath);

        this.gameSocket.onopen = () => {
            console.log('Game WebSocket connection established');
        };

        this.gameSocket.onmessage = (e) => {
            const data = JSON.parse(e.data);

            if (data.type === 'side_assignment') {
                this.assignedSide = data.side;
                console.log(`Side assigned: ${this.assignedSide}`);
                this.players = {
                    left: new Player(data.players.left.username, 'left'),
                    right: new Player(data.players.right.username, 'right')
                };
                this.updateScoreboard();
            } else if (data.type === 'move') {
                this.handleOpponentMovement(data);
            } else if (data.type === 'ball_state') {
                this.handleBallState(data);
            } else if (data.type === 'score_update') {
                this.players.left.updateScore(data.players.left.score);
                this.players.right.updateScore(data.players.right.score);
                console.log(`Score update received: Player 1 (${this.players.left.username}) - ${this.players.left.score}, Player 2 (${this.players.right.username}) - ${this.players.right.score}`);
                this.updateScoreboard();
            } else if (data.type === 'game_over') {
                console.log(`Game over. Winner: ${data.winner}`);
                
                this.handleGameOver(data.winner);
            }
        };

        this.gameSocket.onclose = (e) => {
            console.error('Game WebSocket closed unexpectedly:', e);
        };

        this.gameSocket.onerror = (e) => {
            console.error('WebSocket error:', e);
        };
    }

    handleOpponentMovement(data) {
        if (data.side !== this.assignedSide) {
            console.log(`Handling opponent movement for side: ${data.side}`);
            if (data.side === 'left') {
                this.keyState.left = data.keyState;
            } else {
                this.keyState.right = data.keyState;
            }
        }
    }

    handleBallState(data) {
        this.ball.position.set(data.position.x, data.position.y, data.position.z);
        this.ballVelocity.set(data.velocity.x, data.velocity.y, data.velocity.z);
    }

    updateScoreboard() {
        const player1Name = document.getElementById('player1-name');
        const player2Name = document.getElementById('player2-name');
        const player1Score = document.getElementById('player1-score');
        const player2Score = document.getElementById('player2-score');
        
        player1Name.textContent = this.players.left.username;
        player2Name.textContent = this.players.right.username;
        player1Score.textContent = this.players.left.score;
        player2Score.textContent = this.players.right.score;

        console.log(`Scoreboard updated: Player 1 (${this.players.left.username}) - ${this.players.left.score}, Player 2 (${this.players.right.username}) - ${this.players.right.score}`);
    }

    sendScoreUpdate(sideToInc) {
        if (this.gameSocket && this.gameSocket.readyState === WebSocket.OPEN) {
            this.gameSocket.send(JSON.stringify({
                type: 'score_update',
                player: sideToInc
            }));
            console.log(`Sent score update for side: ${sideToInc}`);
        } else {
            console.error('Game WebSocket is not open. Cannot send score update.');
        }
    }

    displayWinner(winner) {
        const gameCon = document.getElementById('gameCon');
        gameCon.innerHTML = `
            <h1>${winner} is the winner!</h1>
            <button id="homeButton">Go to Home</button>
        `;

        document.getElementById('homeButton').addEventListener('click', () => {
            document.getElementById('gameCon').style.display = 'none';
            document.getElementById('sideBar').style.display = 'flex';
            document.getElementById('mainPageHome').style.display = 'flex';
        });
    }

    sendMovement(keyStateU) {
        if (this.gameSocket && this.gameSocket.readyState === WebSocket.OPEN) {
            this.gameSocket.send(JSON.stringify({
                type: 'move',
                keyState: keyStateU,
                side: this.assignedSide
            }));
        } else {
            console.error('Game WebSocket is not open. Cannot send movement.');
        }
    }

    sendBallState() {
        if (this.gameSocket && this.gameSocket.readyState === WebSocket.OPEN) {
            const ballState = {
                type: 'ball_state',
                position: { x: this.ball.position.x, y: this.ball.position.y, z: this.ball.position.z },
                velocity: { x: this.ballVelocity.x, y: this.ballVelocity.y, z: this.ballVelocity.z }
            };
            this.gameSocket.send(JSON.stringify(ballState));
        } else {
            console.error('Game WebSocket is not open. Cannot send ball state.');
        }
    }

    initGame() {
        this.scene = new THREE.Scene();
        this.createTable();
        this.createRackets();
        this.createBall();
        this.createCamera();
        this.createRenderer();
        this.addLights();
        this.addHelpers();
        this.addEventListeners();
        this.animate();
    }

    createTable() {
        this.tableMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00, shininess: 30 });
        this.tableGeometry = new THREE.BoxGeometry(this.tableW, this.tableH, this.tableD);
        this.table = new THREE.Mesh(this.tableGeometry, this.tableMaterial);
        this.table.castShadow = true;
        this.table.receiveShadow = true;
        this.table.position.set(0, -10, -600 / 4);
        this.scene.add(this.table);
    }

    createRackets() {
        this.racketMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, shininess: 30 });
        this.racketGeometry = new THREE.BoxGeometry(this.racketW, this.racketH, this.racketD);

        this.racket = new THREE.Mesh(this.racketGeometry, this.racketMaterial);
        this.racket.castShadow = true;
        this.racket.receiveShadow = true;
        this.racket.position.set(-((this.tableW / 2) - (this.racketW / 2) - 10), this.tableH / 2 + this.racketH, -(this.tableD / 4));
        this.scene.add(this.racket);

        this.rRacket = new THREE.Mesh(this.racketGeometry, this.racketMaterial);
        this.rRacket.castShadow = true;
        this.rRacket.receiveShadow = true;
        this.rRacket.position.set((this.tableW / 2) - (this.racketW / 2) - 10, this.tableH / 2 + this.racketH, -(this.tableD / 4));
        this.scene.add(this.rRacket);
    }

    createBall() {
        this.ballGeometry = new THREE.SphereGeometry(15, 300, 300);
        this.ballMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.ball = new THREE.Mesh(this.ballGeometry, this.ballMaterial);
        this.ball.castShadow = true;
        this.ball.receiveShadow = true;
        this.ball.position.set(0, this.tableH / 2 + 7, -(this.tableD / 4));
        this.scene.add(this.ball);
    }

    createCamera() {
        this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 1, 2000);
        this.camera.position.set(0, 400, 300);
        this.camera.lookAt(0, 0, 0);
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(new THREE.Color(0x01106C));
        document.getElementById('gameCon').appendChild(this.renderer.domElement);
    }

    addLights() {
        this.ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffcc00, 5);
        this.directionalLight.position.set(1200 / 2, 300, -600 / 2);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.camera.near = 1;
        this.directionalLight.shadow.camera.far = 2000;
        this.directionalLight.shadow.camera.left = -1200;
        this.directionalLight.shadow.camera.right = 1200;
        this.directionalLight.shadow.camera.top = 400;
        this.directionalLight.shadow.camera.bottom = -400;
        this.directionalLight.shadow.mapSize.width = 1024;
        this.directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(this.directionalLight);
    }

    addHelpers() {
        this.gridHelper = new THREE.GridHelper(2000, 50, 0xff0000, 0xff0000);
        this.scene.add(this.gridHelper);

        this.axesHelper = new THREE.AxesHelper(1000);
        this.scene.add(this.axesHelper);
    }

    addEventListeners() {
        window.addEventListener('resize', () => this.onResize());
        document.addEventListener('keydown', (event) => this.onKeyDown(event));
        document.addEventListener('keyup', (event) => this.onKeyUp(event));
    }

    onResize() {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        this.camera.aspect = newWidth / newHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(newWidth, newHeight);
    }

    onKeyDown(event) {
        if ((this.assignedSide === 'left' || this.assignedSide === 'right') &&
            (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            this.keyState[this.assignedSide][event.key === 'ArrowUp' ? 'up' : 'down'] = true;
            this.sendMovement(this.keyState[this.assignedSide]);
        }
    }

    onKeyUp(event) {
        if ((this.assignedSide === 'left' || this.assignedSide === 'right') &&
            (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            this.keyState[this.assignedSide][event.key === 'ArrowUp' ? 'up' : 'down'] = false;
            this.sendMovement(this.keyState[this.assignedSide]);
        }
    }

    moveRackets() {
        // console.log("MoveRockets  ===> ", assignedSide);
        // Move the local player's racket
        if (this.assignedSide === 'left') {
            // console.log(keyState);
            if (this.keyState.right.up && this.rRacket.position.z > -395 && this.rRacket.position.z <= 95) {
                // console.log("CALLED1");
                this.rRacket.position.z -= 5; // Fixed movement direction
                // console.log('Moving right racket up:', rRacket.position.z);
            }
            if (this.keyState.right.down && this.rRacket.position.z >= -395 && this.rRacket.position.z < 95) {
                // console.log("CALLED2");
                this.rRacket.position.z += 5; // Fixed movement direction
                // console.log('Moving right racket down:', rRacket.position.z);
            }
            console.log("CALLED");
            if (this.keyState.left.up && this.racket.position.z > -395 && this.racket.position.z <= 95) {
                this.racket.translateZ(-5);
                // console.log('Moving left racket up:', racket.position.z);
            }
            if (this.keyState.left.down && this.racket.position.z >= -395 && this.racket.position.z < 95) {
                this.racket.translateZ(5);
                // console.log('Moving left racket down:', racket.position.z);
            }
    
            // Move opponent's right racket based on opponentKeyState
        } else if (this.assignedSide === 'right') {
            // console.log(keyState);
            if (this.keyState.right.up && this.rRacket.position.z > -395 && this.rRacket.position.z <= 95) {
                this.rRacket.translateZ(-5);
                // console.log('Moving right racket up:', rRacket.position.z);
            }
            if (this.keyState.right.down && this.rRacket.position.z >= -395 && this.rRacket.position.z < 95) {
                this.rRacket.translateZ(5);
                // console.log('Moving right racket down:', rRacket.position.z);
            }
            // console.log("C");
            // Move opponent's left racket based on opponentKeyState
            if (this.keyState.left.up && this.racket.position.z > -395 && this.racket.position.z <= 95) {
                // console.log("C1");
                this.racket.position.z -= 5; // Fixed movement direction
                // console.log('Moving left racket up:', racket.position.z);
            }
            if (this.keyState.left.down && this.racket.position.z >= -395 && this.racket.position.z < 95) {
                // console.log("C2");
                this.racket.position.z += 5; // Fixed movement direction
                // console.log('Moving left racket down:', racket.position.z);
            }
        }
    }

    moveBall()
    {
        // Update ball position based on its velocity
        this.ball.position.x += this.ballVelocity.x;
        this.ball.position.y += this.ballVelocity.y;
        this.ball.position.z += this.ballVelocity.z;
    
        // Ball position to stay within table boundaries
        this.ball.position.x = Math.max(this.tableProp.minX, Math.min(this.tableProp.maxX, this.ball.position.x));
        this.ball.position.z = Math.max(this.tableProp.minZ, Math.min(this.tableProp.maxZ, this.ball.position.z));
        this.checkCollision();
    }

    checkCollision() {
        // Check collision with table depth boundaries
        if (this.ball.position.z - this.ballRadius <= this.tableProp.minZ && this.ballVelocity.z < 0) {
            // Ball hits the lower wall
            this.ballVelocity.z *= -1;
        } else if (this.ball.position.z + this.ballRadius >= this.tableProp.maxZ && this.ballVelocity.z > 0) {
            // Ball hits the upper wall
            this.ballVelocity.z *= -1;
        }

        // When player scores
        if (this.ball.position.x + this.ballRadius >= this.tableProp.maxX && this.ballVelocity.x > 0) {
            // right
            // player1.increaseScore();
            // updateScoreOnDis();
            this.resetBall('left');
        } else if (this.ball.position.x - this.ballRadius <= this.tableProp.minX && this.ballVelocity.x < 0) {
            // left
            // player2.increaseScore();
            // updateScoreOnDis();
            this.resetBall('right');
        }

        // Check collision with left racket
        if (
            this.ball.position.x - this.ballRadius <= this.racket.position.x + this.racketW / 2 &&
            this.ball.position.x + this.ballRadius >= this.racket.position.x - this.racketW / 2 &&
            this.ball.position.y - this.ballRadius <= this.racket.position.y + this.racketH / 2 &&
            this.ball.position.y + this.ballRadius >= this.racket.position.y - this.racketH / 2 &&
            this.ball.position.z + this.ballRadius >= this.racket.position.z - this.racketD / 2 &&
            this.ball.position.z - this.ballRadius <= this.racket.position.z + this.racketD / 2
        ) {
            this.ballVelocity.x *= -1;
        }

        // Check collision with right racket
        if (
            this.ball.position.x - this.ballRadius <= this.rRacket.position.x + this.racketW / 2 &&
            this.ball.position.x + this.ballRadius >= this.rRacket.position.x - this.racketW / 2 &&
            this.ball.position.y - this.ballRadius <= this.rRacket.position.y + this.racketH / 2 &&
            this.ball.position.y + this.ballRadius >= this.rRacket.position.y - this.racketH / 2 &&
            this.ball.position.z + this.ballRadius >= this.rRacket.position.z - this.racketD / 2 &&
            this.ball.position.z - this.ballRadius <= this.rRacket.position.z + this.racketD / 2
        ) {
            this.ballVelocity.x *= -1;
        }
    }

    resetBall(sideToInc) {
        this.ball.position.set(0, this.tableH / 2 + 7, -(this.tableD / 4));
        this.sendScoreUpdate(sideToInc);
    }

    stopAnimation() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    // Method to reset or clean up variables
    cleanUp() {
        if (this.table) {
            this.scene.remove(this.table);
            this.table.geometry.dispose();
            this.table.material.dispose();
            this.table = null;
        }

        if (this.racket) {
            this.scene.remove(this.racket);
            this.racket.geometry.dispose();
            this.racket.material.dispose();
            this.racket = null;
        }

        if (this.rRacket) {
            this.scene.remove(this.rRacket);
            this.rRacket.geometry.dispose();
            this.rRacket.material.dispose();
            this.rRacket = null;
        }

        if (this.ball) {
            this.scene.remove(this.ball);
            this.ball.geometry.dispose();
            this.ball.material.dispose();
            this.ball = null;
        }

        // Dispose of lights if necessary
        if (this.ambientLight) {
            this.ambientLight = null;
        }
        if (this.directionalLight) {
            this.directionalLight = null;
        }

        // Dispose of helpers if necessary
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
            this.gridHelper = null;
        }
        if (this.axesHelper) {
            this.scene.remove(this.axesHelper);
            this.axesHelper = null;
        }

        // Dispose of camera and renderer
        if (this.camera) {
            this.camera = null;
        }
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }

        if (this.scene) {
            this.scene.clear();
            this.scene = null;
        }

        this.tableMaterial = null;
        this.tableGeometry = null;
        this.racketMaterial = null;
        this.racketGeometry = null;
        this.rRacketMaterial = null;
        this.rRacketGeometry = null;
        this.ballGeometry = null;
        this.ballMaterial = null;
        this.ballVelocity = new THREE.Vector3(4, 0, 4); // Reset or set as needed
        this.keyState = {
            left: { up: false, down: false },
            right: { up: false, down: false }
        };
        this.players = {};
        this.gameSocket = null;
        this.globalSocket = null;
        this.assignedSide = null;
    }

    handleGameOver(winner) {
        this.gameRunning = false;
        this.stopAnimation(); // Stop the animation loop
        this.cleanUp(); // Clean up variables

        // Display the winner
        this.displayWinner(winner);
    }

    animate() {
        if (!this.gameRunning) return;
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

        // Display score
        // updateScoreOnDis();
        // Function to move rackets within the table boundaries
        this.moveRackets();
        this.moveBall();

        const now = Date.now();
        if (now - this.lastBallUpdateTime > 300) {  // Adjust the interval as needed
            this.sendBallState();
            this.lastBallUpdateTime = now;
        }

        // Racket position to stay within table boundaries
        this.racket.position.y = Math.max(-this.tableH / 2 + this.halfRacketHeight, Math.min(this.tableH / 2 - this.halfRacketHeight, this.racket.position.y));
        this.rRacket.position.y = Math.max(-this.tableH / 2 + this.halfRacketHeight, Math.min(this.tableH / 2 - this.halfRacketHeight, this.rRacket.position.y));

        this.renderer.render(this.scene, this.camera);
        // orbit.update();
    }


    init() {
        this.GlobSocket();
        console.log("IAM INIT");
    }
};

















