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
        this.gameRunning = false; 

        this.collisionBuffer = 1;
        this.minVelocity = 2;
        this.lastCollisionTime = 0;
        this.edgeTolerance = 10;
        this.collisionCooldown = 100;
        this.cornerTolerance = 5;
        this.gameBuild =false;
    }

	GameSocket(friendUsername) {
        const wsPath = `wss://${window.location.host}/wss/game/${friendUsername}/`;

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
            }else if (data.type === 'game_start') {
                console.log("GOT GAME START: ", data);
                this.startAnimation(); 
            }else if (data.type === 'request_ready') {
                console.log("Player ready?????")
                this.gameSocket.send(JSON.stringify({
                    type: 'player_ready'
                }));
            }
        };

        this.gameSocket.onclose = (e) => {
            console.error('Game WebSocket closed unexpectedly:', e);
        };

        this.gameSocket.onerror = (e) => {
            console.error('WebSocket error:', e);
        };
    }

    startAnimation() {
        console.log("GAME STARTED");
        this.gameRunning = true;
        this.animate();
    }

    handleGameCancelled(reason)
    {
        this.gameRunning = false;
        this.stopAnimation();
        this.cleanUp();

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
        this.ball.position.set(data.ball_position[0], data.ball_position[1], data.ball_position[2]);
        this.ballVelocity.set(data.velocity[0], data.velocity[1], data.velocity[2]);
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
        let racket_pos =- null;
        if (this.assignedSide === 'left')
            racket_pos = this.racket.position;
        else
            racket_pos = this.rRacket.position;
        if (this.gameSocket && this.gameSocket.readyState === WebSocket.OPEN) {
            this.gameSocket.send(JSON.stringify({
                type: 'move',
                keyState: keyStateU,
                side: this.assignedSide,
                position: racket_pos
            }));
        } else {
            console.error('Game WebSocket is not open. Cannot send movement.');
        }
    }


    async initGame() {
        return new Promise((resolve, reject) => {
            try {
                this.scene = new THREE.Scene();
                this.createTable();
                this.createBall();    
                this.createRackets();    
                this.createCamera();    
                this.createRenderer();    
                this.addLights();    
                this.addHelpers();    
                this.addEventListeners();    
                this.gameBuild = true;
    
                resolve();
            } catch (error) {
                reject(error);
            }
        });
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

        try {
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
                this.sendMovement(this.keyState[this.assignedSide]);
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
                this.sendMovement(this.keyState[this.assignedSide]);
            }
        } catch (error) {
            console.log("Error in move rackets:", error);
            return;
        }
        // Move the local player's racket
        
    }

    stopAnimation() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    // Method to reset or clean up variables
    cleanUp() {
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

        if (this.ambientLight) {
            this.ambientLight = null;
        }
        if (this.directionalLight) {
            this.directionalLight = null;
        }

        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
            this.gridHelper = null;
        }
        if (this.axesHelper) {
            this.scene.remove(this.axesHelper);
            this.axesHelper = null;
        }

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
        this.ballVelocity = new THREE.Vector3(5, 0, 5);
        this.keyState = {
            left: { up: false, down: false },
            right: { up: false, down: false }
        };
        this.players = {};
        this.gameSocket.close();
        this.gameSocket = null;
        this.assignedSide = null;
        const gameCon = document.getElementById('gameCon');
        while (gameCon.firstChild) {
            gameCon.removeChild(gameCon.firstChild);
        }
    }

    handleGameOver(winner) {
        this.gameRunning = false;
        this.stopAnimation();
        this.cleanUp();
        this.displayWinner(winner);
    }

    animate() {
        if (!this.gameRunning) return;
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        
        this.moveRackets();


        // Racket position to stay within table boundaries
        this.racket.position.y = Math.max(-this.tableH / 2 + this.halfRacketHeight, Math.min(this.tableH / 2 - this.halfRacketHeight, this.racket.position.y));
        this.rRacket.position.y = Math.max(-this.tableH / 2 + this.halfRacketHeight, Math.min(this.tableH / 2 - this.halfRacketHeight, this.rRacket.position.y));

        this.renderer.render(this.scene, this.camera);
        // orbit.update();
    }

    async init(friendUsername) {
        try {
            console.log("EEEEEEEEEEEW");
            await this.initGame();
            console.log(this.gameBuild);
        } catch (error) {
            console.log("Error initializing game:", error);
            return;
        }
    

        console.log("Checking if scene is rendering...");
        if (!this.scene) {
            console.error("Scene was not created properly");
        } else {
            console.log("Scene rendering is initialized.");
        }       

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
    
        console.log(friendUsername);
        this.GameSocket(friendUsername);
    }
    
}