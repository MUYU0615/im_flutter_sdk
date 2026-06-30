part of 'client_web.dart';

Map<String, dynamic> _asMap(dynamic params) {
  if (params is Map<String, dynamic>) {
    return params;
  }
  if (params is Map) {
    return Map<String, dynamic>.from(params);
  }
  return {};
}

List<String> _asStringList(dynamic value) {
  if (value is List) {
    return value.map((item) => item.toString()).toList();
  }
  if (value == null) {
    return const [];
  }
  return [value.toString()];
}

Set<String> _stringSet(dynamic value) => _asStringList(value).toSet();

List<String> _sortedStrings(Iterable<String> values) {
  return values.toSet().toList()..sort();
}

List<int> _asIntList(dynamic value) {
  if (value is List) {
    return value
        .map((item) => item is int ? item : int.tryParse(item.toString()))
        .whereType<int>()
        .toList();
  }
  if (value is int) {
    return [value];
  }
  final parsed = int.tryParse(value?.toString() ?? '');
  return parsed == null ? const [] : [parsed];
}

int? _asInt(dynamic value) {
  if (value is int) {
    return value;
  }
  return int.tryParse(value?.toString() ?? '');
}

List<Map<String, dynamic>> _asMapList(dynamic value) {
  if (value is List) {
    return value.map(_asMap).toList();
  }
  return const [];
}

String? _userInfoFieldForType(dynamic type) {
  final value = type is int ? type : int.tryParse(type?.toString() ?? '');
  switch (value) {
    case 0:
      return 'nickName';
    case 1:
      return 'avatarUrl';
    case 2:
      return 'mail';
    case 3:
      return 'phone';
    case 4:
      return 'gender';
    case 5:
      return 'sign';
    case 6:
      return 'birth';
    case 100:
      return 'ext';
    default:
      return null;
  }
}

Map<String, dynamic> _unsupported(String manager, String method) {
  return {
    method: {
      'code': 900001,
      'description': 'Unsupported on Web: $manager.$method',
    },
  };
}
