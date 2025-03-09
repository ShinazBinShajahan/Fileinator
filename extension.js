const vscode = require('vscode');
const fs = require('fs').promises;
const path = require('path');

function activate(context) {
    console.log('Fileinator is now active!');

    async function updateIgnoreContext(uri) {
        if (!uri || !uri.fsPath) {
            await vscode.commands.executeCommand('setContext', 'fileinator.isIgnored', false);
            return;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            await vscode.commands.executeCommand('setContext', 'fileinator.isIgnored', false);
            return;
        }

        const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath).replace(/\\/g, '/');
        const config = vscode.workspace.getConfiguration('fileinator');
        const ignoredFolders = config.get('ignoredFolders', []);

        const isIgnored = ignoredFolders.some(ignored => 
            relativePath === ignored || relativePath.startsWith(ignored + '/')
        );
        
        await vscode.commands.executeCommand('setContext', 'fileinator.isIgnored', isIgnored);
        console.log(`Context updated - relativePath: "${relativePath}", isIgnored: ${isIgnored}`);
    }

    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(async () => {
            const uri = vscode.window.activeTextEditor?.document.uri;
            await updateIgnoreContext(uri);
        }),
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('fileinator.ignoredFolders')) {
                const uri = vscode.window.activeTextEditor?.document.uri;
                await updateIgnoreContext(uri);
            }
        })
    );
    let generateCompleteDataDisposable = vscode.commands.registerCommand('fileinator.generateCompleteData', async (uri) => {
        if (!uri || !uri.fsPath) {
            vscode.window.showErrorMessage('Please right-click a folder!');
            return;
        }

        await updateIgnoreContext(uri); 

        const folderPath = uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found!');
            return;
        }

        const config = vscode.workspace.getConfiguration('fileinator');
        const ignoredFolders = config.get('ignoredFolders', []);
        const relativeFolder = path.relative(workspaceFolder.uri.fsPath, folderPath).replace(/\\/g, '/');
        if (ignoredFolders.some(ignored => relativeFolder === ignored || relativeFolder.startsWith(ignored + '/'))) {
            vscode.window.showInformationMessage(`Folder "${relativeFolder}" is ignored by Fileinator.`);
            return;
        }

        const excludeDirs = ['node_modules', '__pycache__', '.git', 'build', 'dist'];
        const excludeExts = ['.lock', '.log', '.md'];

        async function getFiles(dir) {
            let results = [];
            try {
                const items = await fs.readdir(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    const relativePath = path.relative(workspaceFolder.uri.fsPath, fullPath).replace(/\\/g, '/');
                    const isIgnored = ignoredFolders.some(ignored => 
                        relativePath === ignored || relativePath.startsWith(ignored + '/')
                    );

                    if (isIgnored) continue;

                    if (item.isDirectory()) {
                        if (!excludeDirs.includes(item.name)) {
                            const subFiles = await getFiles(fullPath);
                            results = results.concat(subFiles);
                        }
                    } else if (!excludeExts.includes(path.extname(item.name))) {
                        results.push(fullPath);
                    }
                }
            } catch (err) {
                console.error(`Error reading directory ${dir}: ${err.message}`);
                vscode.window.showErrorMessage(`Failed to scan ${dir}: ${err.message}`);
            }
            return results;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Generating complete data for ${relativeFolder}`,
            cancellable: false
        }, async () => {
            const files = await getFiles(folderPath);
            if (files.length === 0) {
                vscode.window.showWarningMessage(`No files found in ${relativeFolder}.`);
                return;
            }

            const fileContents = await Promise.all(
                files.map(async (file) => {
                    const relativePath = path.relative(workspaceFolder.uri.fsPath, file).replace(/\\/g, '/');
                    try {
                        const stats = await fs.stat(file);
                        if (stats.size > 10 * 1024 * 1024) {
                            return `${relativePath}:\n\ncontents:\nFile too large to display (>10MB)\n\n`;
                        }
                        const content = await fs.readFile(file, 'utf8');
                        return `${relativePath}:\n\ncontents:\n${content.trim()}\n\n`;
                    } catch (err) {
                        return `${relativePath}:\n\ncontents:\nError reading file: ${err.message}\n\n`;
                    }
                })
            );

            const outputContent = fileContents.join('============================\n\n');
            const document = await vscode.workspace.openTextDocument({
                content: outputContent,
                language: 'plaintext',
                uri: vscode.Uri.parse(`untitled:Complete Data - ${relativeFolder}`)
            });
            await vscode.window.showTextDocument(document);
            vscode.window.showInformationMessage(`Complete data generated for ${relativeFolder}`);
        });
    });

    let generateFileTreeDisposable = vscode.commands.registerCommand('fileinator.generateFileTree', async (uri) => {
        if (!uri || !uri.fsPath) {
            vscode.window.showErrorMessage('Please right-click a folder!');
            return;
        }

        await updateIgnoreContext(uri);

        const folderPath = uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found!');
            return;
        }

        const config = vscode.workspace.getConfiguration('fileinator');
        const ignoredFolders = config.get('ignoredFolders', []);
        const relativeFolder = path.relative(workspaceFolder.uri.fsPath, folderPath).replace(/\\/g, '/');
        if (ignoredFolders.some(ignored => relativeFolder === ignored || relativeFolder.startsWith(ignored + '/'))) {
            vscode.window.showInformationMessage(`Folder "${relativeFolder}" is ignored by Fileinator.`);
            return;
        }

        const excludeDirs = ['node_modules', '__pycache__', '.git', 'build', 'dist'];

        async function buildTree(dir, prefix = '') {
            let tree = '';
            try {
                const items = await fs.readdir(dir, { withFileTypes: true });
                const filteredItems = items.filter(item => {
                    const relativePath = path.relative(workspaceFolder.uri.fsPath, path.join(dir, item.name)).replace(/\\/g, '/');
                    return !excludeDirs.includes(item.name) && 
                           !ignoredFolders.some(ignored => relativePath === ignored || relativePath.startsWith(ignored + '/'));
                });

                for (let i = 0; i < filteredItems.length; i++) {
                    const item = filteredItems[i];
                    const fullPath = path.join(dir, item.name);
                    const isLast = i === filteredItems.length - 1;
                    const connector = isLast ? '└── ' : '├── ';
                    tree += `${prefix}${connector}${item.name}\n`;
                    if (item.isDirectory()) {
                        const newPrefix = prefix + (isLast ? '    ' : '│   ');
                        tree += await buildTree(fullPath, newPrefix);
                    }
                }
            } catch (err) {
                tree += `${prefix}└── Error reading directory: ${err.message}\n`;
            }
            return tree;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Generating file tree for ${relativeFolder}`,
            cancellable: false
        }, async () => {
            const treeContent = await buildTree(folderPath);
            if (!treeContent.trim()) {
                vscode.window.showWarningMessage(`No files or folders found in ${relativeFolder}.`);
                return;
            }

            const outputContent = `File Tree for ${relativeFolder}:\n\n${treeContent}`;
            const document = await vscode.workspace.openTextDocument({
                content: outputContent,
                language: 'plaintext',
                uri: vscode.Uri.parse(`untitled:Filetree - ${relativeFolder}`)
            });
            await vscode.window.showTextDocument(document);
            vscode.window.showInformationMessage(`File tree generated for ${relativeFolder}`);
        });
    });

    let ignoreFromGenerationsDisposable = vscode.commands.registerCommand('fileinator.ignoreFromGenerations', async (uri) => {
        if (!uri || !uri.fsPath) {
            vscode.window.showErrorMessage('Please right-click a folder!');
            return;
        }

        await updateIgnoreContext(uri);

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found!');
            return;
        }

        const relativeFolder = path.relative(workspaceFolder.uri.fsPath, uri.fsPath).replace(/\\/g, '/');
        const config = vscode.workspace.getConfiguration('fileinator');
        const ignoredFolders = config.get('ignoredFolders', []);

        if (ignoredFolders.includes(relativeFolder)) {
            vscode.window.showInformationMessage(`Folder "${relativeFolder}" is already ignored.`);
            return;
        }

        ignoredFolders.push(relativeFolder);
        await config.update('ignoredFolders', ignoredFolders, vscode.ConfigurationTarget.Workspace);
        await updateIgnoreContext(uri); 
        vscode.window.showInformationMessage(`Folder "${relativeFolder}" added to Fileinator ignore list`);
    });

    let includeInGenerationsDisposable = vscode.commands.registerCommand('fileinator.includeInGenerations', async (uri) => {
        if (!uri || !uri.fsPath) {
            vscode.window.showErrorMessage('Please right-click a folder!');
            return;
        }

        await updateIgnoreContext(uri); 

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found!');
            return;
        }

        const relativeFolder = path.relative(workspaceFolder.uri.fsPath, uri.fsPath).replace(/\\/g, '/');
        const config = vscode.workspace.getConfiguration('fileinator');
        let ignoredFolders = config.get('ignoredFolders', []);

        if (!ignoredFolders.includes(relativeFolder)) {
            vscode.window.showInformationMessage(`Folder "${relativeFolder}" is not ignored.`);
            return;
        }

        ignoredFolders = ignoredFolders.filter(folder => folder !== relativeFolder);
        await config.update('ignoredFolders', ignoredFolders, vscode.ConfigurationTarget.Workspace);
        await updateIgnoreContext(uri); 
        vscode.window.showInformationMessage(`Folder "${relativeFolder}" removed from Fileinator ignore list`);
    });

    context.subscriptions.push(generateCompleteDataDisposable);
    context.subscriptions.push(generateFileTreeDisposable);
    context.subscriptions.push(ignoreFromGenerationsDisposable);
    context.subscriptions.push(includeInGenerationsDisposable);

    async function initialize() {
        const initialUri = vscode.window.activeTextEditor?.document.uri;
        if (initialUri) await updateIgnoreContext(initialUri);
    }
    initialize();
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};