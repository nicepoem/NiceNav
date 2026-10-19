import type { Component } from 'vue'

/** BlockShell 可填充的具名插槽 */
export type LayoutSlots = {
  topNav?: Component
  topFull?: Component
  leftSidebar?: Component
  mainTop?: Component
  main?: Component
  mainBottom?: Component
  rightSidebar?: Component
  bottomFull?: Component
  footer?: Component
}

/** 一个功能模块（一块积木） */
export type AppModule = {
  id: string
  title: string
  routePath: string
  slots: LayoutSlots
  /** 默认显示左侧栏 */
  showLeft?: boolean
  /** 默认显示右侧栏 */
  showRight?: boolean
}

declare module 'vue-router' {
  interface RouteMeta {
    moduleId?: string
  }
}
