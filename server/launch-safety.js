// server/launch-safety.js — validation/quoting helpers for the "launch in terminal" feature.

// Windows: backslashes are normal. Reject newlines, backtick, double quote, the cmd.exe metacharacters
// % & ^, and ; (Windows Terminal treats a bare `;` argument as a command separator).
const UNSAFE_CWD_WIN = /[\n\r`"%&^;]/
const UNSAFE_CWD_POSIX = /[\n\r`'"\\]/

const isSafeCwd = (cwd, isWin) => !(isWin ? UNSAFE_CWD_WIN : UNSAFE_CWD_POSIX).test(cwd)

// Single-quoted PowerShell literal. PowerShell treats U+2018–U+201B as single quotes as well as ASCII ',
// so all of them are doubled (a curly apostrophe in a folder name would otherwise end the string).
const psQuote = v => `'${String(v).replace(/['\u2018\u2019\u201A\u201B]/g, m => m + m)}'`

module.exports = { isSafeCwd, psQuote }
