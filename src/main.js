import './style.css';
import './cad-statusbar.css';
import './drawing-editor-header.css';
import './drawing-view-grips.css';
import { recoverWorkspace } from './app/workspace-startup.js';
import { createModelApplication } from './app/model-application.js';

const workspace = await recoverWorkspace();
await createModelApplication(workspace);
