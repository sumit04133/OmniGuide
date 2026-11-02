// OmniGuide Figma Plugin Sandbox Code
// Interacts with Figma's selection model and communicates with ui.html

figma.showUI(__html__, { width: 380, height: 520, themeColors: true });

function getSelectedText() {
  const selection = figma.currentPage.selection;
  if (!selection || selection.length === 0) {
    return { error: "No layer selected. Please select a text layer or frame." };
  }

  // Find text nodes in selection
  const textNodes = [];
  function traverse(node) {
    if (node.type === "TEXT") {
      textNodes.push(node);
    } else if ("children" in node) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const node of selection) {
    traverse(node);
  }

  if (textNodes.length === 0) {
    return { error: "No text layers found in current selection." };
  }

  const combinedText = textNodes.map(n => n.characters).join("\n\n");
  const nodeName = selection[0].name;

  return {
    text: combinedText,
    nodeName: nodeName,
    textNodeIds: textNodes.map(n => n.id)
  };
}

// Send initial selection on launch
figma.ui.postMessage({
  type: "SELECTION_CHANGED",
  data: getSelectedText()
});

// Listen for selection changes on the canvas
figma.on("selectionchange", () => {
  figma.ui.postMessage({
    type: "SELECTION_CHANGED",
    data: getSelectedText()
  });
});

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === "GET_SELECTION") {
    figma.ui.postMessage({
      type: "SELECTION_CHANGED",
      data: getSelectedText()
    });
  } else if (msg.type === "APPLY_REWRITE") {
    const { replacementText, textNodeIds } = msg;
    try {
      if (textNodeIds && textNodeIds.length > 0) {
        for (const id of textNodeIds) {
          const node = figma.getNodeById(id);
          if (node && node.type === "TEXT") {
            await figma.loadFontAsync(node.fontName);
            node.characters = replacementText;
            figma.notify("OmniGuide: Compliant copy applied to canvas!");
            break;
          }
        }
      }
    } catch (err) {
      figma.notify("Failed to update text: " + err.message, { error: true });
    }
  } else if (msg.type === "CLOSE_PLUGIN") {
    figma.closePlugin();
  }
};
