// mcfinder.c — cubiomes wrapper for the web finder (engine v2: + map support).
#include "generator.h"
#include "finders.h"
#include "util.h"
#include <emscripten.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

static Generator G;
static int      MC   = MC_1_21;
static uint64_t SEED = 0;

EMSCRIPTEN_KEEPALIVE int c_mc_newest(void){ return MC_NEWEST; }

// Stable index -> structure enum value, for building the UI structure list.
EMSCRIPTEN_KEEPALIVE
int structConst(int idx){
    switch(idx){
        case 0:  return Village;
        case 1:  return Outpost;
        case 2:  return Desert_Pyramid;
        case 3:  return Jungle_Temple;
        case 4:  return Swamp_Hut;
        case 5:  return Igloo;
        case 6:  return Ocean_Ruin;
        case 7:  return Shipwreck;
        case 8:  return Monument;
        case 9:  return Mansion;
        case 10: return Ruined_Portal;
        case 11: return Ancient_City;
        case 12: return Treasure;
        case 13: return Trail_Ruins;
        case 14: return Trial_Chambers;
        default: return -1;
    }
}

EMSCRIPTEN_KEEPALIVE
void initGen(int mc, int large, uint64_t seed){
    MC = mc; SEED = seed;
    setupGenerator(&G, mc, large ? LARGE_BIOMES : 0);
    applySeed(&G, DIM_OVERWORLD, seed);
}

EMSCRIPTEN_KEEPALIVE
int biomeAtBlock(int bx, int bz, int by){
    return getBiomeAt(&G, 4, bx >> 2, by >> 2, bz >> 2);
}

EMSCRIPTEN_KEEPALIVE
const char* biomeName(int id){
    const char *s = biome2str(MC, id);
    return s ? s : "";
}

// Fill a caller-provided 256*3 byte buffer with the Amidst-style biome colors.
EMSCRIPTEN_KEEPALIVE
void fillBiomeColors(unsigned char *out /* [256*3] */){
    unsigned char colors[256][3];
    initBiomeColors(colors);
    memcpy(out, colors, 256*3);
}

// Fill `out` (sx*sz ints) with biome ids for the area, north-west corner at
// scaled (x,z), at the given scale (1,4,16,64,256). y is in scaled units.
EMSCRIPTEN_KEEPALIVE
int genBiomeArea(int *out, int x, int z, int sx, int sz, int scale, int y){
    Range r; memset(&r, 0, sizeof(r));
    r.scale = scale; r.x = x; r.z = z; r.sx = sx; r.sz = sz; r.y = y; r.sy = 1;
    int *cache = allocCache(&G, r);
    if(!cache) return 0;
    int err = genBiomes(&G, cache, r);
    if(!err) memcpy(out, cache, (size_t)sx*sz*sizeof(int));
    free(cache);
    return err ? 0 : 1;
}

// List viable structures of `structType` inside the block box. Writes x,z
// pairs into `out` (up to maxN pairs). Returns the number written.
EMSCRIPTEN_KEEPALIVE
int listStructures(int structType, int x0, int z0, int x1, int z1,
                   int *out, int maxN){
    StructureConfig sc;
    if(!getStructureConfig(structType, MC, &sc)) return 0;
    int regBlocks = sc.regionSize * 16;
    int r0x = (int)floorf((float)x0/regBlocks) - 1;
    int r1x = (int)floorf((float)x1/regBlocks) + 1;
    int r0z = (int)floorf((float)z0/regBlocks) - 1;
    int r1z = (int)floorf((float)z1/regBlocks) + 1;
    int n = 0;
    for(int rz = r0z; rz <= r1z && n < maxN; rz++)
    for(int rx = r0x; rx <= r1x && n < maxN; rx++){
        Pos p;
        if(!getStructurePos(structType, MC, SEED, rx, rz, &p)) continue;
        if(p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
        if(!isViableStructurePos(structType, &G, p.x, p.z, 0)) continue;
        out[n*2] = p.x; out[n*2+1] = p.z; n++;
    }
    return n;
}

// ---- combined multi-criteria search ----
#define MAX_HITS 1500
static int gHits[MAX_HITS*3];
EMSCRIPTEN_KEEPALIVE int hitsPtr(void){ return (int)(intptr_t)gHits; }

#define MAX_STRUCT 40000
static int gStruct[MAX_STRUCT*2];   // x,z pairs, filled via listStructures
static inline int sq(int v){ return v*v; }

static int fdiv4(int a, int b){ int q=a/b; if((a%b)&&((a<0)!=(b<0))) q--; return q; }

// Prefetch the biome grid once (scale 4) over the padded region, then scan
// against the in-memory grid. Orders of magnitude faster than per-point lookups.
EMSCRIPTEN_KEEPALIVE
int searchLocations(int biomeA,int biomeB,int adjDist,
                    int structType,int minStruct,int structRadius,
                    int cx,int cz,int range,int step,int mergeDist){
    const int SC=16;                      // biome sampling step in blocks (16 = fast & accurate enough)
    int pad = (biomeB>=0) ? adjDist : 0;
    int gx0 = fdiv4(cx-range-pad, SC);
    int gz0 = fdiv4(cz-range-pad, SC);
    int cols = (cx+range+pad - gx0*SC)/SC + 2;
    int rows = (cz+range+pad - gz0*SC)/SC + 2;
    if((long)cols*rows > 60000000L) return -1;   // guard: area too large

    Range r; memset(&r,0,sizeof(r));
    r.scale=SC; r.x=gx0; r.z=gz0; r.sx=cols; r.sz=rows; r.y=15; r.sy=1;
    int *grid = allocCache(&G, r);
    if(!grid) return -1;
    if(genBiomes(&G, grid, r)){ free(grid); return -1; }

    int ns=0;
    if(structType>=0)
        ns=listStructures(structType, cx-range-structRadius, cz-range-structRadius,
                          cx+range+structRadius, cz+range+structRadius,
                          gStruct, MAX_STRUCT);

    int adjC = adjDist/SC;                 // adjacency radius in cells
    int sub  = adjC>20 ? adjC/20 : 1;      // sub-step for adjacency scan (cells)
    int stride = step/SC; if(stride<1) stride=1;
    int adjDist2 = adjDist*adjDist;
    int sr2 = structRadius*structRadius;
    int merge2 = mergeDist*mergeDist;

    // cell-index bounds of the (unpadded) search box within the grid
    int bi0 = (cx-range - gx0*SC)/SC, bi1 = (cx+range - gx0*SC)/SC;
    int bj0 = (cz-range - gz0*SC)/SC, bj1 = (cz+range - gz0*SC)/SC;
    if(bi0<0) bi0=0; if(bj0<0) bj0=0;
    if(bi1>cols-1) bi1=cols-1; if(bj1>rows-1) bj1=rows-1;

    int hits=0;
    for(int cj=bj0; cj<=bj1; cj+=stride){
        for(int ci=bi0; ci<=bi1; ci+=stride){
            if(grid[cj*cols+ci] != biomeA) continue;
            int wx = gx0*SC + ci*SC;
            int wz = gz0*SC + cj*SC;

            if(biomeB>=0){
                int found=0;
                for(int dj=-adjC; dj<=adjC && !found; dj+=sub){
                    int nj=cj+dj; if(nj<0||nj>=rows) continue;
                    for(int di=-adjC; di<=adjC; di+=sub){
                        int ni=ci+di; if(ni<0||ni>=cols) continue;
                        if((di*SC)*(di*SC)+(dj*SC)*(dj*SC) > adjDist2) continue;
                        if(grid[nj*cols+ni]==biomeB){ found=1; break; }
                    }
                }
                if(!found) continue;
            }

            int cnt=0;
            if(structType>=0){
                for(int i=0;i<ns;i++)
                    if(sq(gStruct[i*2]-wx)+sq(gStruct[i*2+1]-wz) <= sr2) cnt++;
                if(cnt<minStruct) continue;
            }

            int dup=0;
            for(int h=0;h<hits;h++)
                if(sq(gHits[h*3]-wx)+sq(gHits[h*3+1]-wz) <= merge2){ dup=1; break; }
            if(dup) continue;

            if(hits<MAX_HITS){ gHits[hits*3]=wx; gHits[hits*3+1]=wz; gHits[hits*3+2]=cnt; hits++; }
        }
    }
    free(grid);
    return hits;
}
