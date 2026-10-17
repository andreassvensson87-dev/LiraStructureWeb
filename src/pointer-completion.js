/** Shared stationary middle-click gesture. Editors retain navigation, validation and commits. */
export function createPointerCompletion({ getCommand, complete }) {
  let press = null;
  const modified = (event) => event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
  return {
    down(event) {
      press = null;
      if (event.button !== 1 || modified(event) || event.pointerType === 'touch') return;
      const command = getCommand();
      if (command) press = { id: event.pointerId, x: event.clientX, y: event.clientY, command };
    },
    move(event) {
      if (
        press &&
        event.pointerId === press.id &&
        (modified(event) || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5)
      )
        press = null;
    },
    up(event) {
      if (!press || event.pointerId !== press.id) return false;
      const previous = press;
      press = null;
      if (
        event.button !== 1 ||
        modified(event) ||
        Math.hypot(event.clientX - previous.x, event.clientY - previous.y) > 5 ||
        getCommand() !== previous.command
      )
        return false;
      complete(previous.command);
      return true;
    },
    cancel() {
      press = null;
    },
  };
}
