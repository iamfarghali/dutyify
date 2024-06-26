export function makeDraggable(node) {
  const events = [
    {
      name: "dragstart",
      handler: function (e) {
        if (!e.target.draggable) return;
        e.dataTransfer.setData("text/plain", e.target.id);
        e.target.classList.add("hide");
      },
    },
    {
      name: "drag",
      handler: function (e) {
        return;
      },
    },
    {
      name: "dragend",
      handler: function (e) {
        e.target.classList?.remove("hide");
      },
    },
  ];
  events.forEach((ev) => node.addEventListener(ev.name, ev.handler));
}

export function makeDroppable(node, customEventsListner = undefined) {
  const events = [
    {
      name: "dragenter",
      handler: function (e) {
        e.preventDefault();
      },
    },
    {
      name: "dragover",
      handler: function (e) {
        e.preventDefault();
        highlightTarget(e.target);
        e.dataTransfer.dropEffect = "move";
      },
    },
    {
      name: "dragleave",
      handler: function (e) {
        unHighlightTarget(e.target);
      },
    },
    {
      name: "drop",
      handler: function (e) {
        if (!e.target.classList.contains("card__tasks-container")) return;

        unHighlightTarget(e.target);

        // Get the draggable element
        const id = e.dataTransfer.getData("text/plain");
        const draggableItem = document.getElementById(id);

        // If not the right element then exit
        if (!draggableItem) return;

        // Create an event that carries updated status data and dispatch it to update the state
        const eventData = {
          id: draggableItem.dataset.id,
          status: draggableItem.dataset.status,
          newStatus: e.target.parentElement.id,
        };
        const taskStatusChangedEvent = new CustomEvent("taskStatusChanged", {
          detail: eventData,
        });
        customEventsListner.dispatchEvent(taskStatusChangedEvent);

        // Add it to the drop target
        if (!customEventsListner) e.target.append(draggableItem);
      },
    },
  ];
  events.forEach((ev) => node.addEventListener(ev.name, ev.handler));
}

function highlightTarget(target) {
  if (target.classList.contains("card__tasks-container")) {
    target.parentElement.classList.add("drag-over");
  }
}

function unHighlightTarget(target) {
  if (target.classList.contains("card__tasks-container")) {
    target.parentElement.classList.remove("drag-over");
  }
}

// -----------------------------------

export function formDataExtraction(form) {
  let data = {};
  new FormData(form).forEach((value, key) => (data[key] = value));
  return data;
}

// Generate random id with maximum length 11
export function randomId(length = 6) {
  return Math.random()
    .toString(36)
    .substring(2, length + 2);
}
