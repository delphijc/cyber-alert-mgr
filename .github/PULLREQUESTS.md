# Pull Request Guidelines

Thank you for your interest in contributing to Cyber Alert Manager! To ensure a smooth review process, please follow these guidelines when submitting a pull request (PR).

## Before Submitting a PR

1.  **Fork the Repository**: Create a fork of the repository to your own GitHub account.
2.  **Clone the Fork**: Clone the fork to your local machine.
3.  **Create a Branch**: Create a new branch for your changes. Use a descriptive name, such as `feature/add-new-dashboard` or `bugfix/fix-login-error`.
    ```bash
    git checkout -b feature/my-feature
    ```
4.  **Make Changes**: Make your changes to the code.
5.  **Run Tests**: Ensure that all tests pass before submitting your PR.
    ```bash
    # If tests are available
    npm test
    ```
6.  **Lint Code**: Ensure your code follows the project's style guidelines.
    ```bash
    npm run lint
    ```

## Submitting a PR

1.  **Push Changes**: Push your changes to your fork.
    ```bash
    git push origin feature/my-feature
    ```
2.  **Open a PR**: Go to the original repository and click on "New Pull Request".
3.  **Select Branch**: Select the branch you just pushed.
4.  **Fill out the Template**: Fill out the PR template with the required information.
    *   **Description**: Describe your changes in detail.
    *   **Related Issues**: Link to any related issues (e.g., `Fixes #123`).
    *   **Screenshots**: Include screenshots if your changes affect the UI.
    *   **Checklist**: Check off the items in the checklist.

## Review Process

1.  **Reviewers**: Maintainers will review your PR.
2.  **Feedback**: Address any feedback or requested changes.
3.  **Approval**: Once your PR is approved, it will be merged into the main branch.

## Best Practices

*   **Keep it Small**: Keep your PRs small and focused on a single change.
*   **Commit Messages**: Use clear and descriptive commit messages.
*   **Sync with Main**: Keep your branch up to date with the main branch.
    ```bash
    git fetch upstream
    git merge upstream/main
    ```

Thank you for your contribution!
