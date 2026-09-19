export interface Landmark {
  id: string
  label: string
  world: [number, number]
}

export interface MapVersion {
  id: string
  label: string
  image: string
  aspect: number
  worldBounds: { minX: number; minY: number; maxX: number; maxY: number }
  affine: number[] | null
  landmarks: Landmark[]
  patches: string[]
  isDefault?: boolean
}

const WORLD_BOUNDS = { minX: -512, minY: -512, maxX: 18176, maxY: 17152 }

// Real building world coordinates, pulled from a parsed replay (match
// 9006715157). Same coordinate space as ward x,y. These are fixed structures,
// so they are identical across every modern-map game.
export const DEFAULT_LANDMARKS: Landmark[] = [
  { id: 'radiant-t1-top', label: 'Radiant top T1', world: [2496.0, 10177.0] },
  { id: 'radiant-t1-mid', label: 'Radiant mid T1', world: [7288.0, 6913.0] },
  { id: 'radiant-t1-bot', label: 'Radiant bot T1', world: [13691.875, 1941.75] },
  { id: 'radiant-t2-top', label: 'Radiant top T2', world: [2331.0, 7449.0] },
  { id: 'radiant-t2-mid', label: 'Radiant mid T2', world: [5641.6562, 5394.75] },
  { id: 'radiant-t2-bot', label: 'Radiant bot T2', world: [8472.0, 2065.0] },
  { id: 'radiant-rax-top', label: 'Radiant top melee barracks', world: [2496.0, 4563.0] },
  { id: 'radiant-rax-mid', label: 'Radiant mid melee barracks', world: [4160.0, 3769.0] },
  { id: 'radiant-rax-bot', label: 'Radiant bot melee barracks', world: [4552.0, 1961.0] },
  { id: 'dire-t1-top', label: 'Dire top T1', world: [3557.4375, 14357.031] },
  { id: 'dire-t1-mid', label: 'Dire mid T1', world: [9356.0, 8973.0] },
  { id: 'dire-t1-bot', label: 'Dire bot T1', world: [15101.344, 6081.0] },
  { id: 'dire-t2-top', label: 'Dire top T2', world: [8704.0, 14337.0] },
  { id: 'dire-t2-mid', label: 'Dire mid T2', world: [11328.0, 10433.0] },
  { id: 'dire-t2-bot', label: 'Dire bot T2', world: [15232.0, 8705.0] },
  { id: 'dire-rax-top', label: 'Dire top melee barracks', world: [12730.031, 13817.0] },
  { id: 'dire-rax-mid', label: 'Dire mid melee barracks', world: [13534.0, 12145.0] },
  { id: 'dire-rax-bot', label: 'Dire bot melee barracks', world: [15424.0, 11713.031] },
]

export const MAP_VERSIONS: MapVersion[] = [
  {
    id: '7.41',
    label: 'Patch 7.41',
    image: '/maps/dota_7_41.jpg',
    aspect: 8909 / 8424,
    worldBounds: WORLD_BOUNDS,
    affine: [5.1480448e-5, 9.6481767e-8, 0.031918986, 7.762716e-8, -5.4351208e-5, 0.97913083],
    landmarks: DEFAULT_LANDMARKS,
    patches: [],
    isDefault: true,
  },
]

export function defaultMapVersion(): MapVersion {
  return MAP_VERSIONS.find((m) => m.isDefault) ?? MAP_VERSIONS[0]
}

export function mapVersionForPatch(patch: string | undefined): MapVersion {
  if (patch) {
    const match = MAP_VERSIONS.find((m) => m.patches.includes(patch))
    if (match) return match
  }
  return defaultMapVersion()
}

/** Map a world (x, y) to normalized image coords [0,1]. Uses the calibrated
 * affine when present, else a rotation-ignoring world-bounds approximation. */
export function worldToNorm(
  map: MapVersion,
  x: number,
  y: number,
): [number, number] {
  if (map.affine) {
    const [a, b, c, d, e, f] = map.affine
    return [a * x + b * y + c, d * x + e * y + f]
  }
  const { minX, minY, maxX, maxY } = map.worldBounds
  const u = (x - minX) / (maxX - minX)
  const v = 1 - (y - minY) / (maxY - minY)
  return [u, v]
}

function solve3x3(m: number[][], v: number[]): number[] | null {
  const a = m.map((row, i) => [...row, v[i]])
  for (let col = 0; col < 3; col++) {
    let pivot = col
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null
    ;[a[col], a[pivot]] = [a[pivot], a[col]]
    for (let r = 0; r < 3; r++) {
      if (r === col) continue
      const factor = a[r][col] / a[col][col]
      for (let k = col; k < 4; k++) a[r][k] -= factor * a[col][k]
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]]
}

export interface CalibrationPoint {
  world: [number, number]
  norm: [number, number]
}

export interface AffineFit {
  affine: number[]
  rms: number
  residuals: number[]
}

/** Least-squares fit of a 6-param affine (world -> normalized image) via the
 * normal equations. Needs >=3 non-collinear points; returns rms + residuals. */
export function fitAffine(points: CalibrationPoint[]): AffineFit | null {
  if (points.length < 3) return null

  const mtm = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  const mtu = [0, 0, 0]
  const mtv = [0, 0, 0]

  for (const p of points) {
    const [x, y] = p.world
    const [u, v] = p.norm
    const row = [x, y, 1]
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) mtm[i][j] += row[i] * row[j]
      mtu[i] += row[i] * u
      mtv[i] += row[i] * v
    }
  }

  const abc = solve3x3(mtm, mtu)
  const def = solve3x3(mtm, mtv)
  if (!abc || !def) return null

  const affine = [...abc, ...def]
  const residuals: number[] = []
  let sumSq = 0
  for (const p of points) {
    const [x, y] = p.world
    const [u, v] = p.norm
    const pu = affine[0] * x + affine[1] * y + affine[2]
    const pv = affine[3] * x + affine[4] * y + affine[5]
    const err = Math.hypot(pu - u, pv - v)
    residuals.push(err)
    sumSq += err * err
  }
  return { affine, rms: Math.sqrt(sumSq / points.length), residuals }
}
