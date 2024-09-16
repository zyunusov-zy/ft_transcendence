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
        console.log("HEHEHE");
        this.gameSocket = null;
        this.assignedSide = null;

        this.keyState = {
            left: { up: false, down: false, space: false },
            right: { up: false, down: false, space: false }
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
        this.ballVelocity = new THREE.Vector3(5, 0, 5);
        this.camera = null;
        this.renderer = null;
        this.ambientLight = null;
        this.directionalLight = null;
        this.gridHelper = null;
        this.axesHelper = null;

        this.tablePosZ = -150;
        this.ballRadius = 15;
        this.halfRacketHeight = this.racketH / 2;

        this.tableProp = {
            minZ: this.tablePosZ - this.tableD / 2 + this.ballRadius,
            maxZ: this.tablePosZ + this.tableD / 2 - this.ballRadius,
            minX: -this.tableW / 2,
            maxX: this.tableW / 2
        };

        this.animationFrameId = null;
        this.gameRunning = true; 

        this.collisionBuffer = 1;
        this.minVelocity = 2;
        this.lastCollisionTime = 0;
        this.edgeTolerance = 10;
        this.collisionCooldown = 100;
        this.cornerTolerance = 5;

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
            } else if (data.type === 'game_cancelled'){
                console.log("Here111111222222222:::", data.reason);
                this.handleGameCancelled(data.reason);
            }
        };

        this.gameSocket.onclose = (e) => {
            console.error('Game WebSocket closed unexpectedly:', e);
        };

        this.gameSocket.onerror = (e) => {
            console.error('WebSocket error:', e);
        };
    }

    handleGameCancelled(reason)
    {
        this.gameRunning = false;
        this.stopAnimation();
        this.cleanUp(0);

        const gameCon = document.getElementById('gameCon');
        gameCon.innerHTML = `
            <div class="winner-container">
                <h1 class="winner-text">${reason}</h1>
                <button id="homeButton" class="home-button">Go to Home</button>
            </div>
        `;

        document.getElementById('homeButton').addEventListener('click', () => {
            const gameCon = document.getElementById('gameCon');
            while (gameCon.firstChild) {
                gameCon.removeChild(gameCon.firstChild);
            }
            document.getElementById('gameCon').style.display = 'none';
            document.getElementById('sideBar').style.display = 'flex';
            document.getElementById('mainPageHome').style.display = 'flex';
        });
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
             <div class="winner-container">
                <h1 class="winner-text">${winner} is the winner!</h1>
                <button id="homeButton" class="home-button">Go to Home</button>
            </div>
        `;
        document.getElementById('homeButton').addEventListener('click', () => {
            const gameCon = document.getElementById('gameCon');
            while (gameCon.firstChild) {
                gameCon.removeChild(gameCon.firstChild);
            }
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
                velocity: { x: this.ballVelocity.x, y: this.ballVelocity.y, z: this.ballVelocity.z },
            };
            this.gameSocket.send(JSON.stringify(ballState));
            // console.log(ballState);
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
        // window.addEventListener('resize', () => this.onResize());
        document.addEventListener('keydown', (event) => this.onKeyDown(event));
        document.addEventListener('keyup', (event) => this.onKeyUp(event));
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

    // onResize() {
    //     const newWidth = window.innerWidth;
    //     const newHeight = window.innerHeight;
    //     this.camera.aspect = newWidth / newHeight;
    //     this.camera.updateProjectionMatrix();
    //     this.renderer.setSize(newWidth, newHeight);
    // }

    moveRackets() {
        // console.log("MoveRockets  ===> ", assignedSide);
        // Move the local player's racket
        if (this.assignedSide === 'left') {
            // console.log(keyState);
            if (this.keyState.right.up && this.rRacket.position.z > -395 && this.rRacket.position.z <= 95) {
                // console.log("CALLED1");
                this.rRacket.position.z -= 5;
                // console.log('Moving right racket up:', rRacket.position.z);
            }
            if (this.keyState.right.down && this.rRacket.position.z >= -395 && this.rRacket.position.z < 95) {
                // console.log("CALLED2");
                this.rRacket.position.z += 5;
                // console.log('Moving right racket down:', rRacket.position.z);
            }
            // console.log("CALLED");
            if (this.keyState.left.up && this.racket.position.z > -395 && this.racket.position.z <= 95) {
                this.racket.translateZ(-5);
                // console.log('Moving left racket up:', racket.position.z);
            }
            if (this.keyState.left.down && this.racket.position.z >= -395 && this.racket.position.z < 95) {
                this.racket.translateZ(5);
                // console.log('Moving left racket down:', racket.position.z);
            }
            
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
            if (this.keyState.left.up && this.racket.position.z > -395 && this.racket.position.z <= 95) {
                // console.log("C1");
                this.racket.position.z -= 5;
                // console.log('Moving left racket up:', racket.position.z);
            }
            if (this.keyState.left.down && this.racket.position.z >= -395 && this.racket.position.z < 95) {
                // console.log("C2");
                this.racket.position.z += 5;
                // console.log('Moving left racket down:', racket.position.z);
            }
        }
        // this.sendBallState();
    }

    moveBall()
    {
        this.ball.position.x += this.ballVelocity.x;
        this.ball.position.y += this.ballVelocity.y;
        this.ball.position.z += this.ballVelocity.z;
    
        this.ball.position.x = Math.max(this.tableProp.minX, Math.min(this.tableProp.maxX, this.ball.position.x));
        this.ball.position.z = Math.max(this.tableProp.minZ, Math.min(this.tableProp.maxZ, this.ball.position.z));
        this.checkCollision();
    }

    checkCollision() {
        const now = Date.now();

        // Skip collision check if the last collision was too recent (collision cooldown)
        if (now - this.lastCollisionTime < this.collisionCooldown) {
            return;
        }

        // Ball hits the lower wall
        if (this.ball.position.z - this.ballRadius <= this.tableProp.minZ && this.ballVelocity.z < 0) {
            this.ballVelocity.z *= -1;
        } 
        // Ball hits the upper wall
        else if (this.ball.position.z + this.ballRadius >= this.tableProp.maxZ && this.ballVelocity.z > 0) {
            this.ballVelocity.z *= -1;
        }
        
        // Check collision with left racket
        if (
            this.ball.position.x - this.ballRadius <= this.racket.position.x + this.racketW / 2 + this.collisionBuffer &&
            this.ball.position.x + this.ballRadius >= this.racket.position.x - this.racketW / 2 - this.collisionBuffer &&
            this.ball.position.z + this.ballRadius >= this.racket.position.z - this.racketD / 2 - this.collisionBuffer &&
            this.ball.position.z - this.ballRadius <= this.racket.position.z + this.racketD / 2 + this.collisionBuffer
        ) {
            // Check if the ball is near the edge (corners) of the paddle in the Z direction
            const distanceFromCenterZ = Math.abs(this.ball.position.z - this.racket.position.z);
            const isNearEdgeZ = distanceFromCenterZ >= (this.racketD / 2) - this.edgeTolerance;
        
            // Apply different handling if the ball hit near the edge
            if (isNearEdgeZ) {
                // Slightly adjust the Z velocity for smoother bounce near the paddle's edge
                this.ballVelocity.z += (Math.random() - 0.5) * 0.4;  // Introduce random Z variation to simulate spin
            }
        
            // Prevent jitter with very small velocities in X direction
            if (Math.abs(this.ballVelocity.x) < this.minVelocity) {
                this.ballVelocity.x = (this.ballVelocity.x < 0 ? -1 : 1) * this.minVelocity;
            }
        
            // Invert ball velocity on the X-axis (bounce back)
            this.ballVelocity.x *= -1;
        
            // Move the ball slightly to avoid multiple collisions at the same spot
            this.ball.position.x += this.ballVelocity.x > 0 ? this.collisionBuffer : -this.collisionBuffer;
        
            // Update last collision time to debounce
            this.lastCollisionTime = now;
        }
        
        // Check collision with the right racket (paddle) using the same logic
        if (
            this.ball.position.x - this.ballRadius <= this.rRacket.position.x + this.racketW / 2 + this.collisionBuffer &&
            this.ball.position.x + this.ballRadius >= this.rRacket.position.x - this.racketW / 2 - this.collisionBuffer &&
            this.ball.position.z + this.ballRadius >= this.rRacket.position.z - this.racketD / 2 - this.collisionBuffer &&
            this.ball.position.z - this.ballRadius <= this.rRacket.position.z + this.racketD / 2 + this.collisionBuffer
        ) {
            // Check if the ball is near the edge (corners) of the paddle in the Z direction
            const distanceFromCenterZ = Math.abs(this.ball.position.z - this.rRacket.position.z);
            const isNearEdgeZ = distanceFromCenterZ >= (this.racketD / 2) - this.edgeTolerance;
        
            // Apply different handling if the ball hit near the edge
            if (isNearEdgeZ) {
                // Slightly adjust the Z velocity for smoother bounce near the paddle's edge
                this.ballVelocity.z += (Math.random() - 0.5) * 0.4;
            }
        
            // Prevent jitter with very small velocities in X direction
            if (Math.abs(this.ballVelocity.x) < this.minVelocity) {
                this.ballVelocity.x = (this.ballVelocity.x < 0 ? -1 : 1) * this.minVelocity;
            }
        
            // Invert ball velocity on the X-axis (bounce back)
            this.ballVelocity.x *= -1;
        
            // Move the ball slightly to avoid multiple collisions at the same spot
            this.ball.position.x += this.ballVelocity.x > 0 ? this.collisionBuffer : -this.collisionBuffer;
        
            // Update last collision time to debounce
            this.lastCollisionTime = now;
        }
    
        // Ball goes beyond the right side (player 1 scores)
        if (this.ball.position.x + this.ballRadius + 10 > this.tableProp.maxX + 5 && this.ballVelocity.x > 0) {
            this.resetBall('left');
        }
        // Ball goes beyond the left side (player 2 scores)
        else if (this.ball.position.x - this.ballRadius - 10 < this.tableProp.minX - 5 && this.ballVelocity.x < 0) {
            this.resetBall('right');
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
    cleanUp(fullyEnded) {
        document.removeEventListener('keydown', this.onKeyDown.bind(this));
        document.removeEventListener('keyup', this.onKeyUp.bind(this));
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
        if (fullyEnded === 1)
        {
            console.log("HWWWWWWWWWWWWWWWWWWWWW");
            this.notifyGameComplete();
        }
        this.gameSocket.close();
        this.gameSocket = null;
        this.assignedSide = null;
        const gameCon = document.getElementById('gameCon');
        while (gameCon.firstChild) {
            gameCon.removeChild(gameCon.firstChild);
        }
    }

    notifyGameComplete() {
        if (this.gameSocket && this.gameSocket.readyState === WebSocket.OPEN) {
            try {
                this.gameSocket.send(JSON.stringify({
                    type: 'game_complete',
                    game_status: 'completed'
                }));
            } catch (error) {
                console.error("Failed to send game complete message:", error);
            }
        } else {
            console.warn("WebSocket is not open. Cannot send game complete message.");
        }
    }

    handleGameOver(winner) {
        this.gameRunning = false;
        this.stopAnimation();
        this.cleanUp(1);

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
        // this.update();
        this.moveBall();

        const now = Date.now();
        if (now - this.lastBallUpdateTime > 2000) {  // Adjust the interval as needed
            this.sendBallState();
            this.lastBallUpdateTime = now;
        }

        // Racket position to stay within table boundaries
        this.racket.position.y = Math.max(-this.tableH / 2 + this.halfRacketHeight, Math.min(this.tableH / 2 - this.halfRacketHeight, this.racket.position.y));
        this.rRacket.position.y = Math.max(-this.tableH / 2 + this.halfRacketHeight, Math.min(this.tableH / 2 - this.halfRacketHeight, this.rRacket.position.y));

        this.renderer.render(this.scene, this.camera);
        // orbit.update();
    }

	init(friendUsername) {
        this.GameSocket(friendUsername);
        console.log("IAM INIT");
    }
}