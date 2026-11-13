"""
kernel.py — partitioning functions and the kernel matrix (Kuwata & Lee, 2017).

Single extraction at volume ratio Vr = V_octanol / V_aqueous:

    f_A(K_OW) = 1 / (Vr * K_OW + 1)      fraction to the aqueous phase
    f_O(K_OW) = 1 - f_A                  fraction to the octanol phase

Kernel element K[i, j] = average of f_A(Vr_i) over bin j
(bin j = centre_j +/- width/2 in log K_OW, sampled every 0.01 log units,
end points included). This reproduces the Igor procedure K_Sol_4 / K_Sol_5
(20181107_Kow_Theory_Kernel_*.pxp) to better than 1e-7.

HOW TO CHANGE
    Different volume ratios:  Kernel(vr=[10, 5, 1, 0.1, 0.01], bin_centers=[-2, -1, 0, 1, 2])
    Different bins:           Kernel(vr=..., bin_centers=[-1, 0, 1, 2], bin_width=1.0)
"""
import numpy as np

from . import config


def fraction_aqueous(log_kow, vr):
    """f_A: fraction of a compound with this log K_OW that stays in water."""
    return 1.0 / (np.asarray(vr, dtype=float) * 10.0 ** np.asarray(log_kow, dtype=float) + 1.0)


def fraction_octanol(log_kow, vr):
    """f_O = 1 - f_A."""
    return 1.0 - fraction_aqueous(log_kow, vr)


class Kernel:
    """Bin-averaged f_A for each volume ratio (rows) and K_OW bin (columns)."""

    def __init__(self, vr, bin_centers, bin_width=config.DEFAULT_BIN_WIDTH,
                 grid_step=config.KERNEL_GRID_STEP):
        self.vr = np.atleast_1d(np.asarray(vr, dtype=float))
        self.bin_centers = np.atleast_1d(np.asarray(bin_centers, dtype=float))
        self.bin_width = float(bin_width)
        self.grid_step = float(grid_step)
        self.matrix = self._build()

    def _bin_grid(self, center):
        half = self.bin_width / 2.0
        n = int(round(self.bin_width / self.grid_step))
        return np.linspace(center - half, center + half, n + 1)   # end points included

    def _build(self):
        K = np.empty((self.vr.size, self.bin_centers.size))
        for j, c in enumerate(self.bin_centers):
            grid = self._bin_grid(c)
            for i, v in enumerate(self.vr):
                K[i, j] = fraction_aqueous(grid, v).mean()
        return K

    @property
    def octanol_matrix(self):
        """Bin-averaged f_O (= 1 - K)."""
        return 1.0 - self.matrix

    def row(self, vr):
        """Kernel row for one volume ratio."""
        i = int(np.argmin(np.abs(self.vr - vr)))
        if not np.isclose(self.vr[i], vr):
            raise ValueError(f"Vr = {vr} is not in this kernel ({self.vr.tolist()})")
        return self.matrix[i]

    def __repr__(self):
        return f"Kernel(vr={self.vr.tolist()}, bin_centers={self.bin_centers.tolist()}, bin_width={self.bin_width})"
