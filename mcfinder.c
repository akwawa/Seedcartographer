// mcfinder.c — cubiomes wrapper for the web finder (engine v2: + map support).
#include "generator.h"
#include "finders.h"
#include "quadbase.h"
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
        case 15: return Fortress;        // Nether
        case 16: return Bastion;         // Nether
        case 17: return Ruined_Portal_N; // Nether
        case 18: return End_City;        // End
        default: return -1;
    }
}

// Dimension a biome belongs to: DIM_NETHER (-1), DIM_OVERWORLD (0), DIM_END (1).
EMSCRIPTEN_KEEPALIVE
int biomeDimension(int id){
    switch(id){
        case nether_wastes: case soul_sand_valley: case crimson_forest:
        case warped_forest: case basalt_deltas:
            return DIM_NETHER;
        case the_end: case small_end_islands: case end_midlands:
        case end_highlands: case end_barrens:
            return DIM_END;
        default:
            return DIM_OVERWORLD;
    }
}

EMSCRIPTEN_KEEPALIVE
void initGen(int mc, int large, uint64_t seed, int dim){
    MC = mc; SEED = seed;
    setupGenerator(&G, mc, large ? LARGE_BIOMES : 0);
    applySeed(&G, dim, seed);
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

// Approximate Overworld surface height (blocks) at block (bx,bz); requires an
// Overworld generator. Returns -9999 on error. The surface noise is derived
// from the seed only, so it is (re)initialized lazily when the seed changes.
static SurfaceNoise SN;
static uint64_t snSeed = 0;
static int snReady = 0;
EMSCRIPTEN_KEEPALIVE
int approxSurfaceY(int bx, int bz){
    if(!snReady || snSeed != SEED){
        initSurfaceNoise(&SN, DIM_OVERWORLD, SEED);
        snSeed = SEED;
        snReady = 1;
    }
    float y;
    if(mapApproxHeight(&y, NULL, &G, &SN, bx >> 2, bz >> 2, 1, 1)) return -9999;
    return (int)lroundf(y);
}

// World spawn point (requires an Overworld generator). Writes x,z into `out`.
EMSCRIPTEN_KEEPALIVE
void getSpawnPos(int *out /* [2] */){
    Pos p = getSpawn(&G);
    out[0] = p.x; out[1] = p.z;
}

// Accurate (biome-checked) stronghold positions, nearest first. Writes x,z
// pairs into `out` (up to maxN pairs). Returns the number written.
EMSCRIPTEN_KEEPALIVE
int listStrongholds(int *out, int maxN){
    StrongholdIter sh;
    initFirstStronghold(&sh, MC, SEED);
    int n = 0;
    int more = 1;
    while(n < maxN && more > 0){
        more = nextStronghold(&sh, &G);
        if(more < 0) return n;
        out[n*2] = sh.pos.x; out[n*2+1] = sh.pos.z; n++;
    }
    return n;
}

// Quad witch huts: for every 2x2 region block inside the box, check the
// transposed 48-bit seed against the quad-base filter (hut size 7x7x9, AFK
// sphere radius 128), then verify all four huts are biome-viable. Writes the
// optimal AFK spot x,z pairs into `out` (up to maxN). Returns the count.
EMSCRIPTEN_KEEPALIVE
int listQuadHuts(int x0, int z0, int x1, int z1, int *out, int maxN){
    StructureConfig sc;
    if(!getStructureConfig(Swamp_Hut, MC, &sc)) return 0;
    int regBlocks = sc.regionSize * 16;
    int r0x = (int)floorf((float)x0/regBlocks) - 1;
    int r1x = (int)floorf((float)x1/regBlocks) + 1;
    int r0z = (int)floorf((float)z0/regBlocks) - 1;
    int r1z = (int)floorf((float)z1/regBlocks) + 1;
    int n = 0;
    for(int rz = r0z; rz <= r1z && n < maxN; rz++)
    for(int rx = r0x; rx <= r1x && n < maxN; rx++){
        // isQuadBase* applies the structure salt itself: pass the transposed
        // raw 48-bit world seed so regions (rx..rx+1, rz..rz+1) land on (0,0)
        if(isQuadBaseFeature24(sc, moveStructure(SEED, -rx, -rz), 7, 7, 9) == 0)
            continue;
        Pos p[4];
        int ok = 1;
        for(int i = 0; i < 4 && ok; i++){
            if(!getStructurePos(Swamp_Hut, MC, SEED, rx+(i&1), rz+(i>>1), &p[i])) ok = 0;
            else if(!isViableStructurePos(Swamp_Hut, &G, p[i].x, p[i].z, 0)) ok = 0;
        }
        if(!ok) continue;
        int spcnt;
        Pos afk = getOptimalAfk(p, 7, 7, 9, &spcnt);
        if(afk.x < x0 || afk.x > x1 || afk.z < z0 || afk.z > z1) continue;
        out[n*2] = afk.x; out[n*2+1] = afk.z; n++;
    }
    return n;
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
