"""
nnls.py — non-negative least squares, numpy only.

    minimize ||A x - b||_2   subject to   x >= 0

This is the Lawson-Hanson active-set algorithm, the same algorithm behind
MATLAB `lsqnonneg` and `scipy.optimize.nnls`. It is written here (instead of
importing scipy) so that the website can run with numpy alone, which keeps
the first page load small. tests/test_nnls.py checks it against scipy.

You should not need to change anything in this file.
"""
import numpy as np


def nnls(A, b, max_iter=None, tol=None):
    """Return (x, residual_norm) with x >= 0 minimizing ||A x - b||."""
    A = np.asarray(A, dtype=float)
    b = np.asarray(b, dtype=float)
    m, n = A.shape
    if max_iter is None:
        max_iter = 3 * n
    if tol is None:
        # same default tolerance as MATLAB lsqnonneg
        tol = 10 * np.finfo(float).eps * np.linalg.norm(A, 1) * max(m, n)

    x = np.zeros(n)
    passive = np.zeros(n, dtype=bool)          # P set (free variables)
    w = A.T @ (b - A @ x)                      # gradient (dual vector)

    outer = 0
    while (~passive).any() and (w[~passive] > tol).any():
        outer += 1
        if outer > max_iter:
            break
        # move the most promising variable into the passive set
        j = np.argmax(np.where(~passive, w, -np.inf))
        passive[j] = True

        # inner loop: keep the passive solution feasible
        while True:
            z = np.zeros(n)
            z[passive] = np.linalg.lstsq(A[:, passive], b, rcond=None)[0]
            if (z[passive] > tol).all():
                x = z
                break
            mask = passive & (z <= tol)
            alpha = np.min(x[mask] / (x[mask] - z[mask]))
            x = x + alpha * (z - x)
            passive &= ~(np.abs(x) < tol)
            x[~passive] = 0.0
        w = A.T @ (b - A @ x)

    return x, float(np.linalg.norm(A @ x - b))
