/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface ImportMetaEnv {
  /**
   * Rotated by setup.sh on every fresh setup/reinstall. When the value stored in the
   * browser differs from this build-time value, the app treats it as a fresh install
   * and wipes any previously stored local database/session data before continuing.
   */
  readonly VITE_INSTALL_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
