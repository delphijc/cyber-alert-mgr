# Contributing to Cyber Alert Manager

First off, thanks for taking the time to contribute!

The following is a set of guidelines for contributing to **Cyber Alert Manager**. These are just guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for Cyber Alert Manager. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

*   **Use a clear and descriptive title** for the issue to identify the problem.
*   **Describe the exact steps to reproduce the problem** in as many details as possible.
*   **Provide specific examples to demonstrate the steps**. Include links to files or GitHub projects, or copy/pasteable snippets, which you use in those examples.
*   **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
*   **Explain which behavior you expected to see instead and why.**

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for Cyber Alert Manager, including completely new features and minor improvements to existing functionality.

*   **Use a clear and descriptive title** for the issue to identify the suggestion.
*   **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
*   **Explain why this enhancement would be useful** to most Cyber Alert Manager users.

### Pull Requests

Please follow these steps to have your contribution considered by the maintainers:

1.  Follow all instructions in the template.
2.  Follow the style guides.
3.  After you submit your pull request, verify that all status checks are passing.
4.  If a status check is failing, and you believe that the failure is unrelated to your change, please leave a comment on the pull request explaining why you believe the failure is unrelated.

## Styleguides

### Git Commit Messages

*   Use the present tense ("Add feature" not "Added feature")
*   Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
*   Limit the first line to 72 characters or less
*   Reference issues and pull requests liberally after the first line

### JavaScript/TypeScript Styleguide

All JavaScript/TypeScript must adhere to [Prettier](https://prettier.io/) and [ESLint](https://eslint.org/) rules.

*   Run `npm run lint` to check for linting errors.

## Development Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/delphijc/cyber-alert-mgr.git
    cd cyber-alert-mgr
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Start the development server**
    ```bash
    npm run dev
    ```

4.  **Build for production**
    ```bash
    npm run build
    ```

## Project Structure

*   `src/` - Source code for the Frontend application
*   `server/` - Backend server code
*   `supabase/` - Supabase configuration and migrations

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
