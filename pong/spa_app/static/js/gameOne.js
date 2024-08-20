class PlayerS {
    constructor(username) {
        this.username = username;
        this.score = 4;
        this.winner = 0;
    }

    increaseScore() {
        this.score++;
    }
}

class GameAPPS {
	constructor(name1, name2) {
        this.keyState = {
            w: false,
			s: false,
			up: false,
			down: false
        };
        this.players = {
			player1: new PlayerS(name1),
            player2: new PlayerS(name2),
		};
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

	initGame() {
		this.updateScoreboard();
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
        this.onKeyDown();
		this.onKeyUp();
    }

	onKeyDown() {
        window.addEventListener('keydown', (event) => {
            if (event.key === 'w') this.keyState.w = true;
            if (event.key === 's') this.keyState.s = true;
            if (event.key === 'ArrowUp') this.keyState.up = true;
            if (event.key === 'ArrowDown') this.keyState.down = true;
        });
    }

    onKeyUp() {
        window.addEventListener('keyup', (event) => {
            if (event.key === 'w') this.keyState.w = false;
            if (event.key === 's') this.keyState.s = false;
            if (event.key === 'ArrowUp') this.keyState.up = false;
            if (event.key === 'ArrowDown') this.keyState.down = false;
        });
    }

	moveRackets() {
        if (this.keyState.w && this.racket.position.z > -395 && this.racket.position.z <= 95) {
			this.racket.translateZ(-5); // Move the racket backward
			// console.log('Rocket props while rendering W: ', racket.position);
		}
	
		if (this.keyState.s && this.racket.position.z >= -395 && this.racket.position.z < 95) {
			this.racket.translateZ(5); // Move the racket forward
			// console.log('Rocket props while rendering S: ', racket.position);
		}
	
		if (this.keyState.up && this.rRacket.position.z > -395 && this.rRacket.position.z <= 95) {
			this.rRacket.translateZ(-5); // Move the right racket backward
			// console.log('Right Racket props while rendering ArrowUp: ', rRacket.position);
		}
	
		if (this.keyState.down && this.rRacket.position.z >= -395 && this.rRacket.position.z < 95) {
			this.rRacket.translateZ(5); // Move the right racket forward
			// console.log('Right Racket props while rendering ArrowDown: ', rRacket.position);
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
            // if (this.players.player1.score === 5)
			// {
			// 	this.handleGameOver(this.players.player1.username);
			// 	return;
			// }
			this.players.player1.increaseScore();
			
            this.updateScoreboard();
            this.resetBall();
        } else if (this.ball.position.x - this.ballRadius <= this.tableProp.minX && this.ballVelocity.x < 0) {
            // left
			// if (this.players.player2.score === 5)
			// {
			// 	this.handleGameOver(this.players.player2.username);
			// 	return;
			// }
            this.players.player2.increaseScore();
            this.updateScoreboard();
            this.resetBall();
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

	resetBall() {
        this.ball.position.set(0, this.tableH / 2 + 7, -(this.tableD / 4));
		// ballVelocity.x *= -1;
		// ballVelocity.z *= -1;
		// ballVelocity.set(2, 0, 2); // Set initial velocity
	}

	stopAnimation() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

	cleanUp() {
		window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
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
        const gameCon = document.getElementById('gameCon');
        while (gameCon.firstChild) {
            gameCon.removeChild(gameCon.firstChild);
        }
    }

	handleGameOver(winner) {
        this.gameRunning = false;
        this.stopAnimation(); // Stop the animation loop
        
        // Display the winner
        const gameData = {
            player1_username: this.players.player1.username,
            player2_username: this.players.player2.username,
            score_player1: this.players.player1.score,
            score_player2: this.players.player2.score,
            winner_username: winner,
        };
        console.log(gameData);
        this.saveGameHistory(gameData);
        this.cleanUp(); // Clean up variables
        this.displayWinner(winner);
    }

    async saveGameHistory(gameData)
    {
        try {
            const response = await fetch('/save-game-history/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'), // Include the CSRF token if required
                },
                body: JSON.stringify(gameData),
            });

            if (!response.ok) {
                throw new Error('Failed to save game history');
            }

            const data = await response.json();
            console.log('Game history saved successfully:', data.message);
        } catch (error) {
            console.log("Error occured while saving game History", error);
        }
    }

	animate() {
        if (this.players.player2.score === 5)
		{
            this.players.player2.winner = 1;
			this.handleGameOver(this.players.player2.username);
			return;
		}else if (this.players.player1.score === 5)
		{
            this.players.player1.winner = 1;
			this.handleGameOver(this.players.player1.username);
			return;
		}
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

        // Display score
        // updateScoreOnDis();
        // Function to move rackets within the table boundaries
        this.moveRackets();
        this.moveBall();

        // Racket position to stay within table boundaries
        this.racket.position.y = Math.max(-this.tableH / 2 + this.halfRacketHeight, Math.min(this.tableH / 2 - this.halfRacketHeight, this.racket.position.y));
        this.rRacket.position.y = Math.max(-this.tableH / 2 + this.halfRacketHeight, Math.min(this.tableH / 2 - this.halfRacketHeight, this.rRacket.position.y));

        this.renderer.render(this.scene, this.camera);
        // orbit.update();
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

	updateScoreboard() {
        const player1Name = document.getElementById('player1-name');
        const player2Name = document.getElementById('player2-name');
        const player1Score = document.getElementById('player1-score');
        const player2Score = document.getElementById('player2-score');
        
		console.log(this.players);
		console.log(this.players.player2.username);
        player1Name.textContent = this.players.player1.username;
        player2Name.textContent = this.players.player2.username;
        player1Score.textContent = this.players.player1.score;
        player2Score.textContent = this.players.player2.score;
    }

	init()
	{
		document.getElementById('gameCon').style.display = 'block';
        document.getElementById('sideBar').style.display = 'none';
        document.getElementById('mainPageHome').style.display = 'none';
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
        
        this.initGame();
	}
}