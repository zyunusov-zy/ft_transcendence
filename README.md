# ft_transcendence

## Overview
**ft_transcendence** is a web-based multiplayer **Pong game** built as part of the **42 School** curriculum. The project integrates **real-time gameplay**, user authentication, and additional game features using modern web technologies.

## Features
### ✅ Completed Features:
- Classic Pong game mechanics
- Real-time multiplayer support
- User authentication (signup, login, logout)
- WebSocket integration for smooth gameplay
- User profiles and match history
- Custom game settings
- Spectator mode
- Friends system and chat functionality
- Docker support for easy deployment

## Tech Stack
- **Frontend:** vanillaJS, CSS, Bootstrap
- **Backend:** Django, Django Channels (for WebSockets)
- **Database:** PostgreSQL
- **Real-time Communication:** WebSockets
- **Deployment:** Docker, Docker Compose

## Setup Instructions
### Using Docker (Recommended)
1. Clone the repository:
   ```sh
   git clone https://github.com/zyunusov-zy/ft_transcendence.git
   cd ft_transcendence
   ```
2. Build and start the containers:
   ```sh
   docker-compose up --build
   ```
3. The application will be available at `http://localhost:8000` (or as specified in the `.env` file).

### Manual Setup
#### Backend:
1. Navigate to the backend directory:
   ```sh
   cd backend
   ```
2. Create a virtual environment:
   ```sh
   python -m venv env
   source env/bin/activate  # On Windows use `env\Scripts\activate`
   ```
3. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
4. Run database migrations:
   ```sh
   python manage.py migrate
   ```
5. Start the backend server:
   ```sh
   python manage.py runserver
   ```

#### Frontend:
1. Navigate to the frontend directory:
   ```sh
   cd ../frontend
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the frontend server:
   ```sh
   npm start
   ```

## Deployment
The project supports Docker for seamless deployment. Use the `docker-compose.yml` file to run the application in a containerized environment.

## Contributing
Contributions are welcome! Feel free to fork the repository and submit pull requests.

---
🎮 **Project Completed! Easily deploy and enjoy the game!**

