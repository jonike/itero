import { Machine, assign } from 'xstate';
import FlowyTree from './FlowyTree.js';
import FlowyTreeNode from './FlowyTreeNode.js';

function entriesListToTree(entriesList) {
  let children = entriesList.map(entry => new FlowyTreeNode(entry, []));
  let root = new FlowyTreeNode(null, children);
  return new FlowyTree(entriesList, root);
}

function generateTestContext() {
  let entries = [
    ['abc', 'def', 'ghi'],
    ['4', '5', 'seventy', '-1' ],
    ['alpha', 'beta', 'gamma', 'delta']
  ];
  return {
    currentNodeId: null,
    nodeTitle: '',
    nodes: {
      '1': {
        id: 1,
        name: 'some letters',
        entries: entriesListToTree(entries[0]),
      },
      '2': {
        id: 2,
        name: 'some numbers',
        entries: entriesListToTree(entries[1]),
      },
      '4': {
        id: 4,
        name: 'some greek letters',
        entries: entriesListToTree(entries[2]),
      }
    },
    displayNodes: [1, 2, 4],
    nodeCursorRowId: 0,
    nodeCursorColId: 0,
  };
}


let createNodeAction = assign(ctxt => {
  let copyNodes = {...ctxt.nodes};
  let existingIds = Object.keys(copyNodes).map(id => parseInt(id));
  let maxId = Math.max(...existingIds);
  let newId = maxId + 1
  let initEntryText = 'TODO';
  let newNodeEntries = entriesListToTree([initEntryText]);
  let newNodeName = 'New document'

  copyNodes[newId] = {
    id: newId,
    name: newNodeName,
    entries: newNodeEntries,
  };

  console.log(" ++ new node = ", copyNodes[newId]);

  let newDisplayNodes = [...ctxt.displayNodes];
  newDisplayNodes.push(newId);


  return {
    currentNodeId: newId,
    nodeCursorRowId: 0,
    nodeCursorColId: 0,
    nodeTitle: 'New document',
    nodes: copyNodes,
    displayNodes: newDisplayNodes,
  };
});


let goUpAction = assign(ctxt => {
  let newRowId = ctxt.nodeCursorRowId === 0 ? 0 : ctxt.nodeCursorRowId - 1;
  return {
    nodeCursorRowId: newRowId,
  };
});

let goDownAction = assign(ctxt => {
  const numEntries = ctxt.nodes[ctxt.currentNodeId].entries.length;
  let newRowId = ctxt.nodeCursorRowId >= numEntries - 1 ? numEntries - 1 : ctxt.nodeCursorRowId + 1;
  return {
    nodeCursorRowId: newRowId,
  };
});

let splitEntryAction = assign(ctxt => {
  let rowId = ctxt.nodeCursorRowId;

  // only update nodes if there's a nodeId
  let newNodes;
  newNodes = {...ctxt.nodes};
  let nodeId = ctxt.currentNodeId;
  let currNode = newNodes[nodeId];
  let currEntry = currNode.entries.getEntry(rowId);

  let colId = ctxt.nodeCursorColId;
  console.log(" Splitting '" + currEntry + "' at colId = ", colId);
  let updatedCurrEntry = currEntry.substring(0, colId);
  let newEntry = currEntry.substring(colId, currEntry.length);

  let newTree = entriesListToTree([...currNode.entries.getEntries()]);
  currNode.entries = newTree;

  newTree.setEntry(rowId, updatedCurrEntry);
  newTree.insertAt(rowId + 1, newEntry);

  return {
    nodeCursorRowId: rowId + 1,
    nodeCursorColId: 0,
    nodes: newNodes,
  };
});




export default (navigateToNodeAction, saveNodeNameAction, saveNodeEntryAction, saveFullCursorAction, saveCursorColIdAction, backspaceAction) => {

  const nodeStates = {
    states: {
      nodeTitle: {
        on: {},
        initial: 'displaying',
        states: {
          editing: {
            on: {
              SAVE_NODE_NAME: {
                target: 'displaying',
                actions: saveNodeNameAction,
              },
              CANCEL_EDITING_NAME: {
                target: 'displaying',
              },
            },
          },
          displaying: {
            on: {
              START_EDITING_NAME: {
                target: 'editing',
              },
            }
          }
        }
      }
    },
  }

  const flowikiStates = {
    initial: 'top',
    states: {
      top: {
        on: {
          INIT_CREATE_NODE: {
            target: ['node.nodeTitle.editing'],
            actions: createNodeAction,
          },
        },
      },
      node: {
        on: {
          UP: {
            actions: goUpAction
          },
          DOWN: {
            actions: goDownAction
          },
          SPLIT_ENTRY: {
            actions: splitEntryAction,
          },
          ENTRY_BACKSPACE: {
            actions: backspaceAction,
          },
          SAVE_NODE_ENTRY: {
            actions: saveNodeEntryAction,
          },
          SAVE_FULL_CURSOR: {
            actions: saveFullCursorAction,
          },
          SAVE_CURSOR_COL_ID: {
            actions: saveCursorColIdAction,
          }
        },
        type: 'parallel',
        ...nodeStates
      }
    }
  };

  return Machine({
    id: 'flowiki',
    initial: 'flowiki',
    context: generateTestContext(),
    states: {
      flowiki: {
        on: {
          NAVIGATE: {
            target: 'flowiki.node',
            actions: navigateToNodeAction,
          },
          GO_HOME: {
            target: 'flowiki.top',
          }
        },
        ...flowikiStates
      }
    }

  });
};
