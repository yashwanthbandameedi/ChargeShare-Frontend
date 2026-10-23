# ChargeShare – EV Charging Marketplace

ChargeShare is a web-based Electric Vehicle (EV) charging marketplace that connects EV owners with charging station hosts.

## Technology Stack

- **Frontend:** React, Vite, JavaScript, CSS
- **Backend:** Java, Spring Boot, REST API
- **Database:** MySQL
- **Version Control:** Git and GitHub

## Main Features

- Browse available EV chargers.
- Search for chargers by city or area.
- Support for car and bike charger categories.
- Host charger registration and management.
- Customer booking functionality.
- Authentication and authorization.
- Charger payment QR support.
- Reviews and ratings.

## Project Structure

- `src/` – React application source code.
- `public/` – Public frontend assets.
- `package.json` – Frontend dependencies and scripts.
- `vite.config.js` – Vite configuration.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL displayed in the terminal.

## Backend

The frontend communicates with the ChargeShare Spring Boot REST API. Configure the backend API URL for the environment where the application is deployed.

## Security

Never commit passwords, JWT secrets, API keys, or private environment files to GitHub. Configure sensitive values through environment variables.

## Academic Project

Developed as a college project to demonstrate an EV charging marketplace using modern web technologies.