#!/usr/bin/env python3
import sys, json
from pynauty import Graph, autgrp

def main():
    data = json.load(sys.stdin)
    n = int(data["n"])
    edges = data["edges"]

    adj = {i: [] for i in range(n)}
    for i, j in edges:
        i = int(i); j = int(j)
        if i == j:
            continue
        adj[i].append(j)
        adj[j].append(i)

    g = Graph(number_of_vertices=n, adjacency_dict=adj)

    res = autgrp(g)
    # pynauty versions differ slightly; handle both
    gens = None
    order = None
    orbits = None

    if isinstance(res, tuple):
        if len(res) >= 2:
            gens, order = res[0], res[1]
        if len(res) >= 3:
            orbits = res[2]

    out = {
        "order": int(order) if order is not None else None,
        "num_generators": len(gens) if gens is not None else None,
        "orbits": orbits,
    }
    json.dump(out, sys.stdout)

if __name__ == "__main__":
    main()
