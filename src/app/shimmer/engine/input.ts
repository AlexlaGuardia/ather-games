// Input state manager
// Click-to-move pathfinding, keyboard shortcuts for menus

export interface InputState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  interact: boolean   // spacebar or Z
  menu: boolean       // ESC — one-shot toggle
  run: boolean        // Shift (unused — always runs)
}

export function createInputManager() {
  const state: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    interact: false,
    menu: false,
    run: false,
  }

  // Track one-shots (pressed, not held)
  let interactPressed = false
  let menuPressed = false

  function onKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowUp':    case 'w': state.up = true; break
      case 'ArrowDown':  case 's': state.down = true; break
      case 'ArrowLeft':  case 'a': state.left = true; break
      case 'ArrowRight': case 'd': state.right = true; break
      case ' ': case 'z': case 'Z':
        if (!interactPressed) {
          state.interact = true
          interactPressed = true
        }
        e.preventDefault()
        break
      case 'Escape':
        if (!menuPressed) {
          state.menu = true
          menuPressed = true
        }
        break
      case 'Shift': state.run = true; break
    }
    // Prevent arrow key scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault()
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowUp':    case 'w': state.up = false; break
      case 'ArrowDown':  case 's': state.down = false; break
      case 'ArrowLeft':  case 'a': state.left = false; break
      case 'ArrowRight': case 'd': state.right = false; break
      case ' ': case 'z': case 'Z':
        interactPressed = false
        break
      case 'Escape':
        menuPressed = false
        break
      case 'Shift': state.run = false; break
    }
  }

  return {
    state,
    /** Call after processing interact to reset the one-shot */
    consumeInteract() {
      state.interact = false
    },
    consumeMenu() {
      state.menu = false
    },
    attach() {
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
    },
    detach() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      // Reset all
      state.up = state.down = state.left = state.right = state.interact = state.menu = state.run = false
      interactPressed = false
      menuPressed = false
    },
  }
}
