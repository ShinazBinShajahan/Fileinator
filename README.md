# Fileinator - VSCode Extension

![Fileinator Icon](icon.png)  
**Version:** 0.0.6  
**Publisher:** shinazbinshajahan  
**Repository:** [github.com/shinazbinshajahan/fileinator](https://github.com/shinazbinshajahan/fileinator)

Fileinator is a lightweight VSCode extension that enhances your workflow by allowing you to scan folders within your workspace and generate detailed outputs. Whether you need a complete dump of file contents or a visual file tree, Fileinator has you covered. It also includes options to ignore specific folders from scans, with seamless integration into the Explorer context menu.

## Features

- **Generate Complete Data**: Creates a single document with the contents of all files in a folder (excluding ignored folders and common build directories).
- **Generate File Tree**: Produces a hierarchical tree view of a folder's structure, omitting ignored and excluded directories.
- **Ignore/Include Folders**: Easily exclude or re-include folders from scans via right-click commands, with dynamic context menu updates.
- **Customizable Exclusions**: Configurable list of ignored folders stored in your workspace settings.
- **Performance Optimized**: Concurrent file reading and progress indicators for a smooth experience.

## Installation

1. **Via VSCode Marketplace** (Recommended):
   - Search for `Fileinator` by `shinazbinshajahan` in the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X` on Mac).
   - Click **Install**.

2. **Manual Installation:**
   - Download the `.vsix` file from the [GitHub Releases](https://github.com/shinazbinshajahan/fileinator/releases).
   - In VSCode, go to Extensions view, click the `...` menu, and select **Install from VSIX**.
   - Select the downloaded `.vsix` file.

## Usage

Fileinator adds four commands to the Explorer context menu when you right-click a folder:

1. **Fileinator - Generate Complete Data**  
   - Scans the selected folder and opens a new tab with the contents of all files (up to 10MB per file).  
   - Excludes ignored folders, `node_modules`, `__pycache__`, `.git`, `build`, `dist`, and files with `.lock`, `.log`, or `.md` extensions.

2. **Fileinator - Generate File Tree**  
   - Generates a tree-like structure of the folder's contents in a new tab, skipping ignored and excluded directories.

3. **Fileinator - Ignore from Generations**  
   - Adds the selected folder to the ignore list, preventing it from appearing in future scans. The option then switches to "Include in Generations" for that folder.

4. **Fileinator - Include in Generations**  
   - Removes the selected folder from the ignore list, making it available for scans again. Only appears for ignored folders.

### Example Workflow

- Right-click a folder (e.g., `src`) → Select **Generate Complete Data** → View all file contents in a new tab.
- Right-click `src/tests` → Select **Ignore from Generations** → It won't appear in future scans.
- Right-click `src/tests` again → Select **Include in Generations** to re-enable it.

## Configuration

Fileinator supports customization through VSCode settings. To configure:

1. Open Settings (`Ctrl+,` or `Cmd+,` on Mac).
2. Search for `Fileinator`.
3. Modify the following option:

- **`fileinator.ignoredFolders`**  
  - **Type:** Array of strings  
  - **Default:** `[]`  
  - **Description:** List of folder paths (relative to the workspace root) to exclude from scans. Example: `["src/tests", "dist"]`.

You can also manage this list via the "Ignore from Generations" and "Include in Generations" commands, which update the workspace settings automatically.

## Requirements

- **VSCode Version:** 1.85.0 or higher
- A workspace with folders to scan

## Known Limitations

- Files larger than 10MB are skipped with a placeholder message to prevent performance issues.
- Only folders (not individual files) can be added to the ignore list via commands.
- Excluded directories (`node_modules`, etc.) and extensions (`.lock`, `.log`, `.md`) are hardcoded but can be customized in future updates.
## Contributing

Contributions are welcome! To get started:

1. Fork the repository: [github.com/shinazbinshajahan/fileinator](https://github.com/shinazbinshajahan/fileinator).
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/fileinator.git  
   cd fileinator  
   ```
3. Install dependencies:
   ```bash
   npm install  
   ```
4. Make changes and test locally:
   - Press F5 in VSCode to launch a development instance.
5. Submit a pull request with a clear description of your changes.

## Development Scripts

- `npm run lint`: Run ESLint to check code quality.
- `npm test`: Execute tests (ensure tests are added to test/).

## Issues and Feedback

Found a bug or have a suggestion? Please open an issue on the [GitHub repository](https://github.com/shinazbinshajahan/fileinator). Include steps to reproduce, your VSCode version, and any relevant logs.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgements

Built with ❤️ by shinazbinshajahan.
Thanks to the VSCode community for inspiration and support.