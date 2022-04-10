// This is a special module which will be searched as a fallback for chores.
// Not all chores distributed with chored will be exported here, it's just
// for the extremely common ones

export { main as bump } from './bump.ts'
export { main as lock } from './lock.ts'
