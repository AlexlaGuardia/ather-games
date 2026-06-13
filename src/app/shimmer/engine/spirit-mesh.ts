// Three.js displacement mesh for battle spirits
// Renders a spirit as real 3D geometry using a depth map
// Output: offscreen canvas that updates every frame for PixiJS to consume

import * as THREE from 'three'

export class SpiritMesh {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private mesh: THREE.Mesh
  private swayPhase = Math.random() * Math.PI * 2

  readonly canvas: HTMLCanvasElement

  constructor(
    colorTexture: THREE.Texture,
    depthTexture: THREE.Texture,
    size = 256,
  ) {
    // Offscreen canvas for PixiJS to read
    this.canvas = document.createElement('canvas')
    this.canvas.width = size
    this.canvas.height = size

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
    })
    this.renderer.setSize(size, size)
    this.renderer.setClearColor(0x000000, 0)

    this.scene = new THREE.Scene()

    // Perspective camera — wider FOV for visible depth
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10)
    this.camera.position.set(0, 0, 2.2)
    this.camera.lookAt(0, 0, 0)

    // Soft ambient + directional light for dimension
    const ambient = new THREE.AmbientLight(0xffffff, 0.7)
    this.scene.add(ambient)
    const directional = new THREE.DirectionalLight(0xffffff, 0.5)
    directional.position.set(1, 1, 2)
    this.scene.add(directional)

    // High-res plane geometry for smooth displacement
    const geo = new THREE.PlaneGeometry(1.6, 1.6, 128, 128)

    // Ensure textures tile properly at edges
    colorTexture.wrapS = colorTexture.wrapT = THREE.ClampToEdgeWrapping
    depthTexture.wrapS = depthTexture.wrapT = THREE.ClampToEdgeWrapping

    const mat = new THREE.MeshStandardMaterial({
      map: colorTexture,
      displacementMap: depthTexture,
      displacementScale: 0.3,
      transparent: true,
      alphaTest: 0.01,
      side: THREE.FrontSide,
      roughness: 0.8,
      metalness: 0.0,
    })

    this.mesh = new THREE.Mesh(geo, mat)
    this.scene.add(this.mesh)

    // Initial render
    this.renderer.render(this.scene, this.camera)
  }

  /** Call every frame to update the sway and re-render */
  tick(dt: number) {
    this.swayPhase += dt * 0.008

    // Camera orbit — subtle 3D perspective shift
    const swayX = Math.sin(this.swayPhase) * 0.18
    const swayY = Math.cos(this.swayPhase * 0.7) * 0.1
    this.camera.position.x = swayX
    this.camera.position.y = swayY
    this.camera.lookAt(0, 0, 0)

    this.renderer.render(this.scene, this.camera)
  }

  /** Adjust displacement intensity */
  setDisplacementScale(scale: number) {
    const mat = this.mesh.material as THREE.MeshStandardMaterial
    mat.displacementScale = scale
  }

  destroy() {
    const mat = this.mesh.material as THREE.MeshStandardMaterial
    mat.dispose()
    this.mesh.geometry.dispose()
    this.renderer.dispose()
  }
}

/** Load textures and create a SpiritMesh. Returns null if depth map unavailable. */
export async function createSpiritMesh(
  imageUrl: string,
  depthUrl: string,
  size = 256,
): Promise<SpiritMesh | null> {
  const loader = new THREE.TextureLoader()

  try {
    const [colorTex, depthTex] = await Promise.all([
      loader.loadAsync(imageUrl),
      loader.loadAsync(depthUrl),
    ])
    colorTex.colorSpace = THREE.SRGBColorSpace
    return new SpiritMesh(colorTex, depthTex, size)
  } catch {
    return null
  }
}
