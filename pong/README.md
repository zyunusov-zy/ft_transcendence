### To start PONG42
Copy the .env data from discord
docker-compose down --volumes --rmi all
docker-compose up --build

### Interact with POSTGRE DB
docker exec -it postgres_db psql -U jayz -d jayz

psql -U zy -d pong42 -h localhost -p 5432



Sometimes, browsers cache resources like HTML files, CSS, and JavaScript. 
Try clearing your browser cache and reloading the page (Ctrl + F5 or Cmd + Shift + R).



Before running, change host_ip_address in the following files:

.env
	FORTYTWO_THING='https://<host_ip_address>/auth42/'
	CSRF_TR_OR='https://<host_ip_address>'

nginx/nginx.conf
	server_name  localhost <host_ip_adress>;

Dockerfile.mkcert
	CMD mkcert -install && mkcert -key-file /certs/key.pem -cert-file /certs/cert.pem localhost host_ip_address  127.0.0.1 ::1