/**
 * 用户模型：本机 localStorage（Node 测试用内存存储）。
 */
const mem = new Map();

function store() {
  if (typeof localStorage !== 'undefined') {
    return {
      get(k) {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : null;
      },
      set(k, v) {
        localStorage.setItem(k, JSON.stringify(v));
      },
    };
  }
  return {
    get(k) {
      return mem.has(k) ? mem.get(k) : null;
    },
    set(k, v) {
      mem.set(k, v);
    },
  };
}

const KEY = 'guandan-coach-user';

/**
 * 空用户档案。
 * @returns {{ dims: Record<string, number>, deals: object[], errors: object[], wins: number, losses: number, created: number }}
 */
export function defaultProfile() {
  return {
    dims: {
      pattern: 40,
      coop: 40,
      bomb: 40,
      clutch: 40,
      tribute: 40,
      returnTribute: 40,
    },
    deals: [],
    errors: [],
    wins: 0,
    losses: 0,
    created: Date.now(),
  };
}

/**
 * 读取档案（无则默认）。
 * @returns {object}
 */
export function loadProfile() {
  return store().get(KEY) || defaultProfile();
}

/**
 * 写入档案。
 * @param {object} p
 * @returns {object}
 */
export function saveProfile(p) {
  store().set(KEY, p);
  return p;
}

/**
 * 重置为本机默认档案。
 * @returns {object}
 */
export function resetProfile() {
  const p = defaultProfile();
  saveProfile(p);
  return p;
}

/**
 * 追加一局记录。
 * @param {object} deal
 * @returns {object}
 */
export function pushDeal(deal) {
  const p = loadProfile();
  p.deals.push(deal);
  saveProfile(p);
  return p;
}

/**
 * 追加一条错误记录。
 * @param {object} err
 * @returns {object}
 */
export function pushError(err) {
  const p = loadProfile();
  p.errors.push(err);
  saveProfile(p);
  return p;
}

/**
 * 记胜负。
 * @param {boolean} win
 * @returns {object}
 */
export function recordWin(win) {
  const p = loadProfile();
  if (win) p.wins += 1;
  else p.losses += 1;
  saveProfile(p);
  return p;
}

/**
 * 合并并夹紧六维。
 * @param {Record<string, number>} partial
 * @returns {object}
 */
export function updateDims(partial) {
  const p = loadProfile();
  p.dims = { ...p.dims, ...partial };
  for (const k of Object.keys(p.dims)) {
    p.dims[k] = Math.max(0, Math.min(100, p.dims[k]));
  }
  saveProfile(p);
  return p;
}

export { KEY };
