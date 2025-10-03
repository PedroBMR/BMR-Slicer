export interface MeshDescriptor {
  positions: Float32Array;
  indices?: Uint32Array;
}

let initialized = false;

export async function init(): Promise<void> {
  initialized = true;
}

function assertInitialized() {
  if (!initialized) {
    throw new Error('WASM adapter has not been initialized.');
  }
}

export async function volume(mesh: MeshDescriptor): Promise<number> {
  assertInitialized();
  void mesh;
  return 0;
}

export async function surfaceArea(mesh: MeshDescriptor): Promise<number> {
  assertInitialized();
  void mesh;
  return 0;
}
