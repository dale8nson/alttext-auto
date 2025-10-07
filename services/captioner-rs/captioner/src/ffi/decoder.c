#include "turbojpeg.h"
#include <stdlib.h>
#include <stdio.h>
#include <stdint.h>

int get_dimensions(tjhandle tj3, const uint8_t *jpegBuf, size_t jpegSize, int *width, int *height)
{

  int success = tj3DecompressHeader(tj3, jpegBuf, jpegSize);

  if (success > 0)
  {
    int errno = tj3GetErrorCode(tj3);
    char *errstr = tj3GetErrorStr(tj3);
    printf("Error: %s", errstr);
    return errno;
  }

  *width = tj3Get(tj3, TJPARAM_JPEGWIDTH);
  *height = tj3Get(tj3, TJPARAM_JPEGHEIGHT);

  return 0;
}

tjhandle init_tj3()
{
  tjhandle tj3 = tj3Init(TJINIT_DECOMPRESS);
  return tj3;
}

int free_tj3(tjhandle tj3)
{
  tj3Destroy(tj3);
  return 0;
}

int decompress(
    tjhandle tj3,
    const uint8_t *jpegBuf,
    size_t jpegSize,
    void *rgbBuf,
    int *width,
    int *height)
{


  // printf("\ndecompress()\n");
  // printf("\nwidth: %d\n", *width);
  int rgbSize = 3 * *width * *height;

  // printf("rgbSize = %lu", rgbSize);
  
  int success = tj3Decompress8(tj3, jpegBuf, jpegSize, rgbBuf, *width * 3, TJPF_RGB);

  if (success > 0)
  {
    int errno = tj3GetErrorCode(tj3);
    char *errstr = tj3GetErrorStr(tj3);
    printf("Error: %s", errstr);
    return errno;
  }

  return 0;
}
