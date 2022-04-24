// This is a special module which will be searched as a fallback for chores.
// Not all chores distributed with chored will be exported here, it's just
// for the extremely common ones

export { default as bump } from './bump.ts'
export { default as lock } from './lock.ts'
