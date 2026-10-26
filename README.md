# CloudKeep — React + Express + MongoDB CRUD app

CloudKeep is a small full-stack starter application with email/password sign-up, sign-in, sign-out, a personal dashboard, and Create/Read/Update/Delete (CRUD) operations for user-owned items.

## Technology stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express REST API
- **NoSQL database:** MongoDB using Mongoose
- **Authentication:** bcrypt password hashing + JWT in an HttpOnly cookie
- **Security basics:** Helmet, configured CORS, input validation, owner-scoped item queries

## 1. Requirements

- Node.js 20 or later (LTS recommended)
- A MongoDB database. The easiest option for this cloud project is MongoDB Atlas. You do not need to install PostgreSQL.

## 2. Create a MongoDB Atlas database (recommended)

1. Create or sign in to an account at <https://www.mongodb.com/cloud/atlas>.
2. Create a project and a free-eligible cluster if the option is available for your region/account.
3. In **Database Access**, create a database user and save its username and password. This is not necessarily the same as your Atlas website login.
4. In **Network Access**, allow the IP address from the computer running the app. For a deployed backend, allow its outbound address or use a carefully designed network setup. Do not leave broad access enabled permanently just to make connection work.
5. Open the cluster's **Connect** dialog and select the driver / Node.js connection-string option.
6. Copy the `mongodb+srv://...` URI. Replace the placeholder username/password and include `cloudkeep` as the database name. If your password contains special characters, URL-encode them in the URI.

Example format only (not a real URI):

```text
mongodb+srv://DB_USER:URL_ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/cloudkeep?retryWrites=true&w=majority
```

MongoDB will create the `cloudkeep` database and its collections when the app first writes data. Mongoose defines `users` and `items` collections and creates the relevant indexes.

### Local MongoDB alternative

If MongoDB Community Server is already installed and running locally, use:

```text
mongodb://127.0.0.1:27017/cloudkeep
```

Otherwise, for this cloud-learning project you can skip local database installation and use Atlas directly.

## 3. Configure the backend

From the project directory, open a terminal and run:

```powershell
cd server
Copy-Item .env.example .env
```

Open `server/.env` and configure these values:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://DB_USER:URL_ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/cloudkeep?retryWrites=true&w=majority
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
CLIENT_ORIGIN=http://localhost:5173
```

Generate a JWT secret in PowerShell with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep `.env` private and do not commit it to GitHub. The URI's username and password are database credentials. If Atlas reports a network access error, review the Atlas Network Access allowlist. If authentication fails, confirm the database user/password and URL-encode special characters in the password.

## 4. Install and run

Use two terminals.

**Terminal A — API:**

```powershell
cd server
npm install
npm run dev
```

The API should report that MongoDB connected and listen on <http://localhost:5000>.

**Terminal B — frontend:**

```powershell
cd client
npm install
npm run dev
```

Open <http://localhost:5173>. During local development, Vite proxies `/api` requests to the Express API on port 5000.

## 5. Features

- Sign up with email and password (passwords are hashed with bcrypt before storage).
- Sign in and sign out.
- JWT session cookie marked HttpOnly.
- Create, view, update and delete personal items.
- Each item query is restricted to the signed-in user's MongoDB ObjectId.
- Duplicate email addresses return a helpful error.
- Health endpoint: `GET /api/health`.

## 6. API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | API and database health status |
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/signin` | Sign in |
| GET | `/api/auth/me` | Get current signed-in user |
| POST | `/api/auth/signout` | Clear session cookie |
| GET | `/api/items` | List the signed-in user's items |
| POST | `/api/items` | Create an item |
| PUT | `/api/items/:id` | Update an owned item |
| DELETE | `/api/items/:id` | Delete an owned item |

## 7. Cloud deployment architecture (AWS + MongoDB Atlas)

This is an implementation guide; it does not create AWS resources automatically. Review AWS and Atlas pricing and limits before provisioning resources.

### Database — MongoDB Atlas

1. Create the Atlas cluster and database user as described above.
2. Configure network access so the hosted API can reach the cluster. Avoid unrestricted public access as a permanent production configuration.
3. Store `MONGODB_URI` and `JWT_SECRET` in a server-side secret store such as AWS Secrets Manager or Parameter Store. Never expose them to React or commit them to Git.

### Backend — Amazon EC2

1. Launch a supported Linux EC2 instance and attach a least-privilege IAM role where appropriate.
2. Deploy the `server` folder from your Git repository, install a supported Node.js LTS release and run `npm ci` (commit a lockfile first) or `npm install`.
3. Set `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, `CLIENT_ORIGIN` and `PORT` as server-side environment variables/secrets.
4. Run the API under a process manager such as systemd or PM2, and place it behind an HTTPS reverse proxy or load balancer for production.
5. Configure security groups to expose only the required ports. Use Systems Manager or carefully restricted SSH for administration.
6. Set `CLIENT_ORIGIN` to the exact origin of the deployed frontend. The production cookie uses Secure, HttpOnly and SameSite=None because frontend and API may be hosted on different sites; both must use HTTPS.

### Frontend — AWS Amplify

1. Push the project to GitHub and connect the repository to Amplify.
2. Set the Amplify app root to `client` if prompted, then build the Vite frontend with `npm install && npm run build` (or `npm ci` when a lockfile is committed); publish the `dist` directory.
3. Set `VITE_API_URL` to the public HTTPS origin of your API, for example `https://api.example.com` without a trailing slash.
4. Update the backend `CLIENT_ORIGIN` to the exact Amplify URL or your custom frontend domain.

### Before using with real users

- Use HTTPS for both frontend and API.
- Configure a strong, unique JWT secret and keep all credentials private.
- Configure rate limiting, login throttling, email verification, password reset and CSRF protections suitable for the cookie-based auth flow.
- Set up database backups, monitoring and alerting; test restoring a backup.
- Do not use real customer data in a demo project.
- Review AWS and MongoDB Atlas pricing and delete resources you no longer need.

## 8. Troubleshooting

- **MongoServerSelectionError / server selection timed out:** Check that the cluster is running and the backend machine's IP is allowed in Atlas Network Access.
- **Authentication failed:** Check the MongoDB database user's credentials; URL-encode special characters in the password.
- **JWT warning:** Set a random `JWT_SECRET` in `server/.env` and restart the API.
- **Frontend cannot reach API:** Confirm the API is running on port 5000. Local Vite has a `/api` proxy configured; in production, set `VITE_API_URL` and allow the exact frontend origin in `CLIENT_ORIGIN`.

This is a learning/demo starter, not a security-audited production identity system.
