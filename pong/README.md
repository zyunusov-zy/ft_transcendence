### To start PONG42
Copy the .env data from discord
docker-compose down --volumes --rmi all
docker-compose up --build

### Interact with POSTGRE DB
docker exec -it postgres_db psql -U jayz -d jayz

psql -U zy -d pong42 -h localhost -p 5432



Sometimes, browsers cache resources like HTML files, CSS, and JavaScript. 
Try clearing your browser cache and reloading the page (Ctrl + F5 or Cmd + Shift + R).
