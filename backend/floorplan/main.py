import os

import numpy as np
import pandas as pd

from api import run_multi_resolution_optimization
from data_models import Connection, FloorPlan, RoomData


def setup_and_run_default_optimization():
    """
    An example function that defines a multi-floor optimization problem
    and runs it using the API.
    """
    all_plans = [
        FloorPlan(
            "Level 2",
            [
                (-10, -36),
                (-10, -34.4),
                (-11, -34.4),
                (-12.06, -30.38),
                (-10.72, -29.26),
                (3.13, -29.26),
                (5.82, -26.67),
                (5.8, 39),
                (9.72, 39.01),
                (10.81, 37.16),
                (12.515, 37.15),
                (12.5, 38.094),
                (14.974, 38.08),
                (15, 37.2),
                (16.92, 37.185),
                (16.05, 22.33),
                (16.04, -33.016),
                (17.84, -34.95),
                (10.18, -42.28),
                (0.36, -42.28),
                (-3.38, -38.86),
                (-9.82, -38.81),
            ],
            fixed_elements={
                "ent": [(13.7, 37.56), (-9.9, -37.43)],
                "bdr": [(-13.3, -30.46), (11.74, 35.3)],
                "loc": [(1.2, -39.54)],
            },
            connections=[
                Connection((0, -35), "l", "lif"),
                Connection((8.67, -30.7), "e", "esc"),
                Connection((14.45, -3.93), "s", "sty"),
            ],
        ),
        FloorPlan(
            "Level 3",
            [
                (-15.84, -31.3),
                (-12.86, -31.15),
                (-12.9, -29.3),
                (-10.4, -29.23),
                (-10.47, -23.4),
                (-7.12, -23.5),
                (-2.74, -19.56),
                (-2.8, 25.73),
                (-3.72, 25.4),
                (-3.72, 37.4),
                (-0.86, 35.68),
                (5.05, 35.68),
                (9.98, 38.3),
                (10, 30),
                (10.67, 30.1),
                (10.64, -0.66),
                (11.31, -11),
                (11.47, -28.9),
                (12.37, -30.07),
                (10, -32.22),
                (9.1, -31.6),
                (1.45, -38.7),
                (-10.23, -38.87),
                (-14.3, -35),
                (-15.76, -35),
            ],
            connections=[
                Connection((-11.65, -30.5), "l", "lif"),
                Connection((-1.3, -25.9), "e", "esc"),
                Connection((8, 7.37), "s", "sty"),
            ],
        ),
        FloorPlan(
            "Level 4",
            [
                (-38.5, -10.37),
                (-38.5, -17.65),
                (-21.55, -19.03),
                (-21.55, -20.14),
                (3, -20),
                (10, -19),
                (17.6, -19),
                (17.76, -15.37),
                (18.19, -15.37),
                (21.26, -18.3),
                (23.24, -18.32),
                (23.24, -16.45),
                (27.56, -12.45),
                (29.7, -12.4),
                (32.1, -10.17),
                (32.13, -8.2),
                (36.54, -3.98),
                (38, -4),
                (37.94, 2.67),
                (37.44, 2.78),
                (36.85, 11.8),
                (36.85, 18.25),
                (32.93, 18.17),
                (33, 20),
                (31.13, 19.92),
                (31.18, 12),
                (28.72, 12.05),
                (28.67, 12.97),
                (25.93, 12.84),
                (25.9, 9.74),
                (27.18, 9.77),
                (27.1, -3.54),
                (23.9, -6.38),
                (8.2, -6.42),
                (7.82, -6.78),
                (2.27, -6.7),
                (1.73, -6.34),
                (-13.24, -6.4),
                (-25.53, -7.93),
                (-25.63, -9.8),
                (-33.65, -10.84),
                (-33.94, -9.7),
            ],
            connections=[
                Connection((20.42, -11.76), "l", "lif"),
                Connection((28.1, -8.28), "e", "esc"),
            ],
        ),
        FloorPlan(
            "Level 5",
            [
                (-38.43, -21.22),
                (-37.98, -14.78),
                (-21.5, -12.5),
                (-21.44, -9.77),
                (25.23, -9.73),
                (27.15, -8.07),
                (27.24, 19),
                (36.23, 19.05),
                (38.34, 0.23),
                (38.3, -13.5),
                (37.94, -13.72),
                (38.27, -14.02),
                (36.32, -15.86),
                (36.04, -15.62),
                (28.93, -22.15),
                (7.76, -22.1),
                (-0.4, -23.35),
                (-26.58, -23.27),
                (-26.62, -22.29),
            ],
            connections=[
                Connection((18.2, -14.16), "l", "lif"),
                Connection((26.9, -10.6), "e", "esc"),
            ],
        ),
        FloorPlan(
            "Level 6",
            [
                (-38.77, -7.15),
                (-38.67, 0.66),
                (-16.38, 3.46),
                (-16.36, 4.47),
                (10.22, 4.47),
                (10.25, 3.12),
                (26.2, 3.12),
                (30.7, 7.28),
                (38.25, -0.05),
                (30.1, -7.74),
                (7.66, -7.7),
                (3.46, -8.5),
                (-21.36, -8.6),
            ],
            connections=[
                Connection((20, -1), "l", "lif"),
                Connection((27, 2), "e", "esc"),
            ],
        ),
    ]

    room_df = pd.read_csv("rooms.csv")
    selected_zones_df = pd.read_csv("selected_zones.csv", skipinitialspace=True)
    rules_df = pd.DataFrame(0.0, index=room_df["short"], columns=room_df["short"])
    np.fill_diagonal(rules_df.values, -1)
    rules_df = pd.read_csv("rules.csv", index_col=0)
    room_data = RoomData(room_df, rules_df, selected_zones_df)

    text_prompt = """
    make toilets repel child with strength 10.
    make entrance attract gen with strength 5.
    ensure gen is compact with weight 1.5.
    """

    # --- 3. Run the Multi-Resolution Optimization ---
    final_results = run_multi_resolution_optimization(
        plans=all_plans,
        room_data=room_data,
        target_node_counts=[50, 300, 500],
        generations=[100, 100, 100],
        pop_sizes=[10, 25, 10],
        total_gfa=10900,
        text_prompt=text_prompt,
        show_progress=True,
        # You can still override specific GA params for all stages here
    )

    # --- 4. Save Final Outputs ---
    if final_results:
        output_dir = "layouts"
        os.makedirs(output_dir, exist_ok=True)
        for i, result in enumerate(final_results):
            svg_path = os.path.join(
                output_dir, f"layout_{i + 1}_fitness_{result.fitness:.2f}.svg"
            )
            with open(svg_path, "w", encoding="utf-8") as f:
                f.write(result.svg_render)
            csv_path = os.path.join(output_dir, f"layout_{i + 1}_areas.csv")
            result.area_distribution.to_csv(csv_path, index=False)
        print(f"\nSaved {len(final_results)} layouts to the '{output_dir}' directory.")


if __name__ == "__main__":
    setup_and_run_default_optimization()
