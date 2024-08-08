function game()
{
	const scene = new THREE.Scene();

    // table
    const tableMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00, shininess: 30 });

    const tableW = 1200;
    const tableH = 75;
    const tableD = 600;

    const tableGeometry = new THREE.BoxGeometry(tableW, tableH, tableD);

    const table = new THREE.Mesh(tableGeometry, tableMaterial);
    table.castShadow = true; // Enable shadow casting
    table.receiveShadow = true; // Enable shadow receiving

    table.position.set(0, -10, -tableD / 4);

    scene.add(table);

    // racket
    const racketMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, shininess: 30 });

    const racketW = 20;
    const racketH = 100;
    const racketD = 100;

    const racketGeometry = new THREE.BoxGeometry(racketW, racketH, racketD);


    // Left racket
    const racket = new THREE.Mesh(racketGeometry, racketMaterial);
    racket.castShadow = true; // Enable shadow casting
    racket.receiveShadow = true; // Enable shadow receiving

    racket.position.set(-((tableW / 2) - (racketW / 2) - 10), tableH / 2 + racketH, -(tableD / 4));

    scene.add(racket);


     // Right racket
    const rRacketMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, shininess: 30 });

    const rRacketGeometry = new THREE.BoxGeometry(racketW, racketH, racketD);

    const rRacket = new THREE.Mesh(rRacketGeometry, rRacketMaterial);
    rRacket.castShadow = true;
    rRacket.receiveShadow = true; // Enable shadow receiving

    rRacket.position.set((tableW / 2) - (racketW / 2) - 10, tableH / 2 + racketH, -(tableD / 4));

    scene.add(rRacket);

    // ball
    const ballGeometry = new THREE.SphereGeometry(15, 300, 300);

    const ballMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
    });

    ball = new THREE.Mesh(ballGeometry, ballMaterial);

    ball.castShadow = true;
    ball.receiveShadow = true;

    ball.position.set(0, tableH / 2 + 7, -(tableD / 4));

    scene.add(ball);


    // ........................................................
    // Create a camera with an increased field of view for a more top-down perspective
    const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(0, 400, 300);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // Enable shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
    renderer.setClearColor(new THREE.Color(0x01106C));
	document.getElementById('gameCon').appendChild(renderer.domElement);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // Add directional light with shadows from right to left
    const directionalLight = new THREE.DirectionalLight(0xffcc00, 5);
    directionalLight.position.set(tableW / 2, 300, table.position.z / 2);
    directionalLight.castShadow = true;

    // Set up shadow camera parameters
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 2000;
    directionalLight.shadow.camera.left = -1200;
    directionalLight.shadow.camera.right = 1200;
    directionalLight.shadow.camera.top = 400;
    directionalLight.shadow.camera.bottom = -400;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;

    scene.add(directionalLight);

    // Create grid helper
    const gridHelper = new THREE.GridHelper(2000, 50, 0xff0000, 0xff0000);
    scene.add(gridHelper);

    // Create axes helper
    const axesHelper = new THREE.AxesHelper(1000);
    scene.add(axesHelper);

    
    // Handle window resize
    window.addEventListener('resize', () => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;

        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(newWidth, newHeight);
        // orbit.update();
    });

    // Event listener for keydown event
    document.addEventListener('keydown', (event) => {
        if ((assignedSide === 'left' || assignedSide === 'right') &&
            (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            keyState[assignedSide][event.key === 'ArrowUp' ? 'up' : 'down'] = true;
            sendMovement(keyState[assignedSide]);
        }
    });

    document.addEventListener('keyup', (event) => {
        if ((assignedSide === 'left' || assignedSide === 'right') &&
            (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            keyState[assignedSide][event.key === 'ArrowUp' ? 'up' : 'down'] = false;
            sendMovement(keyState[assignedSide]);
        }
    });
    
    // _____________________________________________
    
    // Function to move the rackets based on keyState and opponentKeyState
    function moveRackets() {
        // console.log("MoveRockets  ===> ", assignedSide);
        // Move the local player's racket
        if (assignedSide === 'left') {
            // console.log(keyState);
            if (keyState.right.up && rRacket.position.z > -395 && rRacket.position.z <= 95) {
                // console.log("CALLED1");
                rRacket.position.z -= 5; // Fixed movement direction
                // console.log('Moving right racket up:', rRacket.position.z);
            }
            if (keyState.right.down && rRacket.position.z >= -395 && rRacket.position.z < 95) {
                // console.log("CALLED2");
                rRacket.position.z += 5; // Fixed movement direction
                // console.log('Moving right racket down:', rRacket.position.z);
            }
            console.log("CALLED");
            if (keyState.left.up && racket.position.z > -395 && racket.position.z <= 95) {
                racket.translateZ(-5);
                // console.log('Moving left racket up:', racket.position.z);
            }
            if (keyState.left.down && racket.position.z >= -395 && racket.position.z < 95) {
                racket.translateZ(5);
                // console.log('Moving left racket down:', racket.position.z);
            }
    
            // Move opponent's right racket based on opponentKeyState
        } else if (assignedSide === 'right') {
            // console.log(keyState);
            if (keyState.right.up && rRacket.position.z > -395 && rRacket.position.z <= 95) {
                rRacket.translateZ(-5);
                // console.log('Moving right racket up:', rRacket.position.z);
            }
            if (keyState.right.down && rRacket.position.z >= -395 && rRacket.position.z < 95) {
                rRacket.translateZ(5);
                // console.log('Moving right racket down:', rRacket.position.z);
            }
            // console.log("C");
            // Move opponent's left racket based on opponentKeyState
            if (keyState.left.up && racket.position.z > -395 && racket.position.z <= 95) {
                // console.log("C1");
                racket.position.z -= 5; // Fixed movement direction
                // console.log('Moving left racket up:', racket.position.z);
            }
            if (keyState.left.down && racket.position.z >= -395 && racket.position.z < 95) {
                // console.log("C2");
                racket.position.z += 5; // Fixed movement direction
                // console.log('Moving left racket down:', racket.position.z);
            }
        }
    }

    
    // Function to send movement data to the server

    ballVelocity = new THREE.Vector3(4, 0, 4);

    const tablePosZ = -150;
    const ballRadius = 15;
    const halfRacketHeight = racketH / 2;

    const tableProp = {
        minZ: tablePosZ - tableD / 2 + ballRadius,
        maxZ: tablePosZ + tableD / 2 - ballRadius,
        minX: -tableW / 2,
        maxX: tableW / 2
    };
    
    function moveBall()
    {
        // Update ball position based on its velocity
        ball.position.x += ballVelocity.x;
        ball.position.y += ballVelocity.y;
        ball.position.z += ballVelocity.z;
    
        // Ball position to stay within table boundaries
        ball.position.x = Math.max(tableProp.minX, Math.min(tableProp.maxX, ball.position.x));
        ball.position.z = Math.max(tableProp.minZ, Math.min(tableProp.maxZ, ball.position.z));
        checkCollision();
    }

    // Handle ball collision
    function checkCollision() {
        // Check collision with table depth boundaries
        if (ball.position.z - ballRadius <= tableProp.minZ && ballVelocity.z < 0) {
            // Ball hits the lower wall
            ballVelocity.z *= -1;
        } else if (ball.position.z + ballRadius >= tableProp.maxZ && ballVelocity.z > 0) {
            // Ball hits the upper wall
            ballVelocity.z *= -1;
        }

        // When player scores
        if (ball.position.x + ballRadius >= tableProp.maxX && ballVelocity.x > 0) {
            // right
            // player1.increaseScore();
            // updateScoreOnDis();
            resetBall('left');
        } else if (ball.position.x - ballRadius <= tableProp.minX && ballVelocity.x < 0) {
            // left
            // player2.increaseScore();
            // updateScoreOnDis();
            resetBall('right');
        }

        // Check collision with left racket
        if (
            ball.position.x - ballRadius <= racket.position.x + racketW / 2 &&
            ball.position.x + ballRadius >= racket.position.x - racketW / 2 &&
            ball.position.y - ballRadius <= racket.position.y + racketH / 2 &&
            ball.position.y + ballRadius >= racket.position.y - racketH / 2 &&
            ball.position.z + ballRadius >= racket.position.z - racketD / 2 &&
            ball.position.z - ballRadius <= racket.position.z + racketD / 2
        ) {
            ballVelocity.x *= -1;
        }

        // Check collision with right racket
        if (
            ball.position.x - ballRadius <= rRacket.position.x + racketW / 2 &&
            ball.position.x + ballRadius >= rRacket.position.x - racketW / 2 &&
            ball.position.y - ballRadius <= rRacket.position.y + racketH / 2 &&
            ball.position.y + ballRadius >= rRacket.position.y - racketH / 2 &&
            ball.position.z + ballRadius >= rRacket.position.z - racketD / 2 &&
            ball.position.z - ballRadius <= rRacket.position.z + racketD / 2
        ) {
            ballVelocity.x *= -1;
        }
    }

    function endGame() {
        console.log("END GAME!");
    }

    // Reset ball position
    function resetBall(sideToInc) {
        ball.position.set(0, tableH / 2 + 7, -(tableD / 4));
        sendScoreUpdate(sideToInc);
    }

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        // Display score
        // updateScoreOnDis();
        // Function to move rackets within the table boundaries
        moveRackets();
        moveBall();

        const now = Date.now();
        if (now - lastBallUpdateTime > 300) {  // Adjust the interval as needed
            sendBallState();
            lastBallUpdateTime = now;
        }

        // Racket position to stay within table boundaries
        racket.position.y = Math.max(-tableH / 2 + halfRacketHeight, Math.min(tableH / 2 - halfRacketHeight, racket.position.y));
        rRacket.position.y = Math.max(-tableH / 2 + halfRacketHeight, Math.min(tableH / 2 - halfRacketHeight, rRacket.position.y));

        renderer.render(scene, camera);
        // orbit.update();
    }

    animate();
} 