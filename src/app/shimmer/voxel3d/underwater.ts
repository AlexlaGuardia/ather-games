// MOVED to open/shared/underwater (11-14, hub): the walker and the sky outlive the voxel world. This shim keeps
// voxel3d's own imports working until the archive; new code imports open/shared directly.
export * from '../open/shared/underwater'
