import { Machine, assign } from 'xstate';
import { get } from 'svelte/store';
import FlowyTree from './FlowyTree.js';
import { EntryDisplayState, createNewDocument } from "./data.js";
import { docsStore } from './components/stores.js';

let createDocAction = assign(ctxt => {
  let copyDocs = { ...ctxt.documents };
  let newDocName = 'New document'
  let newDoc = createNewDocument(newDocName, 'TODO', copyDocs);
  let newId = newDoc.id;
  copyDocs[newId] = newDoc;


  // add entry into docIdLookup
  let newLookup = { ...ctxt.docIdLookupByDocName };
  newLookup[newDocName] = newId;

  docsStore.saveCurrentDocId(newId);
  docsStore.saveDocName(newDocName);
  docsStore.saveCursor(null, 0);
  docsStore.appendToDocsDisplayList(newId);
  return {
    documents: copyDocs,
    docIdLookupByDocName: newLookup
  };
});


let splitEntryAction = assign(ctxt => {
  let currDocStore = get(docsStore);
  let docId = currDocStore.currentDocId;
  let entryId = currDocStore.cursorEntryId;
  let colId = currDocStore.cursorColId;

  // TODO: only update documents if there's a docId (is this possible?)
  let newDocs = { ...ctxt.documents };
  let currDoc = newDocs[docId];
  let currTree = currDoc.tree;
  let currEntryText = currTree.getEntryText(entryId);
  let parentId = currTree.getParentId(entryId);

  let newTree = new FlowyTree(currTree.getEntries(), currTree.getRoot());
  currDoc.tree = newTree;

  // if at the end of a collapsed item, make a next sibling with empty text
  if (currTree.getEntryDisplayState(entryId) === EntryDisplayState.COLLAPSED
      && colId === currEntryText.length) {

    let newId = newTree.insertEntryBelow(entryId, parentId, '');

    docsStore.saveCursor(newId, 0);
    return {
      documents: newDocs,
    }
  }

  let newEntryText = currEntryText.substring(0, colId);
  let updatedCurrEntry = currEntryText.substring(colId, currEntryText.length);

  newTree.setEntryText(entryId, updatedCurrEntry);
  newTree.insertEntryAbove(entryId, parentId, newEntryText);

  docsStore.saveCursorColId(0);
  return {
    // docCursorColId: 0,
    documents: newDocs,
  };
});

let indentAction = assign(ctxt => {
  let currDocStore = get(docsStore);
  let docId = currDocStore.currentDocId;
  let entryId = currDocStore.cursorEntryId;

  //  1. check if LinkedListItem can be indented
  //  2. if so, get LinkedListItem for entryId in docId, and make it a child of its previous sibling
  let newDocs = { ...ctxt.documents };
  let currTree = newDocs[docId].tree;

  let currItem = currTree.getEntryItem(entryId);
  if (currTree.hasPrevSibling(entryId)) {
    let prevNode = currTree.getPrevSiblingNode(entryId);
    currItem.detach();
    prevNode.appendChildItem(currItem);
    let parentId = prevNode.getId();
    currItem.value.setParentId(parentId);
  }

  return {
    documents: newDocs
  }
});

let dedentAction = assign(ctxt => {
  let currDocStore = get(docsStore);
  let entryId = currDocStore.cursorEntryId;
  let docId = currDocStore.currentDocId;

  //  1. check if LinkedListItem can be dedented
  //  2. if so, get LinkedListItem for entryId in docId, and make it the next sibling of parent
  let newDocs = { ...ctxt.documents };
  let currTree = newDocs[docId].tree;

  let currItem = currTree.getEntryItem(entryId);
  if (currItem.value.hasParent()) {
    let parentItem = currTree.getEntryItem(currItem.value.getParentId());
    currItem.detach();
    parentItem.append(currItem);
    let parentParentId = parentItem.value.getParentId();
    currItem.value.setParentId(parentParentId);
  }

  return {
    documents: newDocs
  }
});


export default (initContext, importDocsAction, saveDocNameAction,
    saveDocEntryAction, backspaceAction,
    collapseEntryAction, expandEntryAction, savePastedEntriesAction, updateEntryLinksAction) => {

  const docStates = {
    states: {
      docTitle: {
        on: {},
        initial: 'displaying',
        states: {
          editing: {
            on: {
              SAVE_DOC_NAME: {
                target: 'displaying',
                actions: saveDocNameAction,
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
          CREATE_DOC: {
            target: ['document.docTitle.editing'],
            actions: createDocAction,
          },
        },
      },
      document: {
        on: {
          COLLAPSE_ENTRY: {
            actions: collapseEntryAction,
          },
          EXPAND_ENTRY: {
            actions: expandEntryAction,
          },
          SPLIT_ENTRY: {
            actions: splitEntryAction,
          },
          ENTRY_BACKSPACE: {
            actions: backspaceAction,
          },
          INDENT: {
            actions: indentAction,
          },
          DEDENT: {
            actions: dedentAction,
          },
          SAVE_DOC_ENTRY: {
            actions: saveDocEntryAction,
          },
          SAVE_PASTED_ENTRIES: {
            actions: savePastedEntriesAction,
          },
          UPDATE_ENTRY_LINKS: {
            actions: updateEntryLinksAction,
          }
        },
        type: 'parallel',
        ...docStates
      }
    }
  };

  return Machine({
    id: 'flowiki',
    initial: 'flowiki',
    context: initContext,
    states: {
      flowiki: {
        on: {
          NAVIGATE: {
            target: 'flowiki.document',
          },
          GO_HOME: {
            target: 'flowiki.top',
          },
          IMPORT_DOCS: {
            target: 'flowiki.top',
            actions: importDocsAction,
          }
        },
        ...flowikiStates
      }
    }

  });
};
