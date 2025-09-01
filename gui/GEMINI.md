# Project Overview

This project is a desktop application built with Electron, React, TypeScript, and Vite. It uses `pnpm` as the package manager. The application appears to be a tool for managing and processing video and subtitle files, with features for organizing projects into workspaces and groups.

## Main Technologies

* **Electron:** For building the cross-platform desktop application.
* **React:** For building the user interface.
* **TypeScript:** For static typing and improved code quality.
* **Vite:** For the build tooling and development server.
* **pnpm:** For package management.
* **Jest:** For testing.
* **Zustand:** For state management.
* **MUI:** For UI components.

## Architecture

The application is structured into three main parts:

* **Main Process (`src/main`):** Handles the application's lifecycle, background tasks, and communication with the renderer process.
* **Preload Script (`src/preload`):** A script that runs in a privileged environment and acts as a bridge between the renderer process and the main process.
* **Renderer Process (`src/renderer`):** The user interface of the application, built with React.

# Building and Running

The following scripts are available in `package.json`:

* **`pnpm dev`:** Starts the application in development mode with hot reloading.
* **`pnpm build`:** Builds the application for production.
* **`pnpm test`:** Runs the tests using Jest.
* **`pnpm lint`:** Lints the code using ESLint.
* **`pnpm format`:** Formats the code using Prettier.

# Development Conventions

* **Package Manager:** The project uses `pnpm` for package management.
* **Code Style:** The project uses ESLint and Prettier for code linting and formatting.
* **Testing:** The project uses Jest for testing. Test files are located alongside the source files and have the `.test.ts` or `.spec.ts` extension.
* **State Management:** The project uses Zustand for state management. Stores are located in the `src/renderer/src/stores` directory.
* **Component Library:** The project uses MUI for UI components.
* **Aliases:** The project uses aliases for module resolution. The aliases are defined in `electron.vite.config.js` and `jest.config.cjs`.
