# Project Structure

```
src/
├── main.ts           # Entry point, initializes app and UI controls
├── app.ts            # SpreadsheetApp - main controller, event handling, clipboard
├── model.ts          # SpreadsheetModel - data layer, cell operations, merge logic
├── renderer.ts       # SpreadsheetRenderer - Canvas rendering, viewport management
├── types.ts          # TypeScript interfaces (Cell, Selection, Viewport, etc.)
├── inline-editor.ts  # InlineEditor - cell editing overlay
├── history-manager.ts # HistoryManager - undo/redo stack
├── data-manager.ts   # DataManager - import/export, local storage
├── ui-controls.ts    # UIControls - settings panel, theme switching
├── search-dialog.ts  # SearchDialog - find functionality
├── themes.json       # Theme color definitions (light/dark)
└── style.css         # Global styles, CSS variables, component styles

public/
├── example-*.json    # Sample data files for demo
└── vite.svg          # Favicon

index.html            # HTML template with toolbar and canvas container
```

## Architecture Pattern
- MVC-like separation:
  - Model: `SpreadsheetModel` (data + business logic)
  - View: `SpreadsheetRenderer` (Canvas rendering)
  - Controller: `SpreadsheetApp` (user interaction, coordination)

## Key Classes
| Class | Responsibility |
|-------|----------------|
| `SpreadsheetApp` | Main orchestrator, event handling, keyboard shortcuts |
| `SpreadsheetModel` | Cell data, merge operations, row/column management |
| `SpreadsheetRenderer` | Canvas drawing, viewport calculation, scrolling |
| `InlineEditor` | Floating input for cell editing |
| `HistoryManager` | Undo/redo action stack |
| `DataManager` | File I/O, localStorage operations |
| `UIControls` | Settings panel, theme management |
| `SearchDialog` | Find/navigate functionality |

## Global Access
- `window.app` - SpreadsheetApp instance (for debugging/API access)
- `window.uiControls` - UIControls instance
