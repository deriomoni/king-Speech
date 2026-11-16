# Restricted unpickler: only numpy dtype/scalar allowed, decoded with struct (no numpy).
import sys, pickle, json, struct, os, glob
class DType:
    def __init__(self, code, *a): self.code = code; self.endian = '<'
    def __setstate__(self, st):
        if isinstance(st, tuple) and len(st) > 1 and st[1] in ('<', '>', '|', '='): self.endian = '<' if st[1] in ('|', '=') else st[1]
FMT = {'f8':'d','f4':'f','i8':'q','i4':'i','i2':'h','i1':'b','u8':'Q','u4':'I','u2':'H','u1':'B','b1':'?'}
def scalar(dt, data=None):
    if isinstance(data, str): data = data.encode('latin1')
    return struct.unpack(dt.endian + FMT[dt.code], data)[0]
class U(pickle.Unpickler):
    def find_class(self, mod, name):
        if mod.startswith('numpy') and name == 'dtype': return DType
        if mod.startswith('numpy') and name == 'scalar': return scalar
        raise pickle.UnpicklingError('blocked %s.%s' % (mod, name))
def conv(o):
    if isinstance(o, dict): return {str(k): conv(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)): return [conv(v) for v in o]
    if isinstance(o, float): return round(o, 2)
    return o
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for p in sorted(glob.glob(os.path.join(src, '*.pkl'))):
    with open(p, 'rb') as f: o = U(f).load()
    n = os.path.basename(p)[:-4]
    json.dump(conv(o), open(os.path.join(out, n + '.json'), 'w'), separators=(',', ':'))
    def shape(x, d=0):
        if d > 3: return '..'
        if isinstance(x, dict): k = list(x)[:6]; return '{%d: %s}' % (len(x), ', '.join('%r:%s' % (kk, shape(x[kk], d+1)) for kk in k[:3]))
        if isinstance(x, (list, tuple)): return '[%d: %s]' % (len(x), shape(x[0], d+1) if x else '')
        return type(x).__name__ + ('=' + repr(x)[:30])
    print(n, shape(o))
