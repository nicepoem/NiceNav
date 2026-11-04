/**
 * IndexedDB structured clone 无法写入 Vue Proxy。
 * 经 JSON 往返得到纯数据对象后再入库。
 */
export function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
