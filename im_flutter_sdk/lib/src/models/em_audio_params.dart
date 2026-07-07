import 'package:im_flutter_sdk/src/tools/em_extension.dart';

/// ~english
/// Audio parameters for voice-to-text conversion.
/// ~end
///
/// ~chinese
/// 语音转文字使用的音频参数。
/// ~end
class EMAudioParams {
  EMAudioParams({
    this.format = EMAudioFormat.pcm,
    this.sampleRate = 16000,
    this.bitsPerSample = 16,
    this.channels = 1,
  });

  final EMAudioFormat format;
  final int sampleRate;
  final int bitsPerSample;
  final int channels;

  Map<String, dynamic> toJson() {
    final data = <String, dynamic>{};
    data.putIfNotNull("format", format.name);
    data.putIfNotNull("sampleRate", sampleRate);
    data.putIfNotNull("bitsPerSample", bitsPerSample);
    data.putIfNotNull("channels", channels);
    return data;
  }
}

enum EMAudioFormat {
  pcm,
  mp3,
  amr,
}
