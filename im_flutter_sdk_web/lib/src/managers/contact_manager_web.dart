part of '../client_web.dart';

class ContactManagerWeb extends ContactManager {
  Future<dynamic> Function(MethodCall call)? _handler;
  int _handlerInstallCount = 0;
  final Map<String, Map<String, dynamic>> _contacts = {};
  final Set<String> _blockList = {};

  @override
  void updateNativeHandler(handler) {
    _handler = handler;
    _handlerInstallCount += 1;
    final client = Client.instance;
    if (client is ClientWeb) {
      client._realSdk?.recordExternalDebugEvent(
        'contact_manager_update_native_handler',
        {
          'installCount': _handlerInstallCount,
          'hasHandler': _handler != null,
          'handlerHashCode': _handler.hashCode,
        },
      );
    }
  }

  bool get hasNativeHandler => _handler != null;
  int get handlerInstallCount => _handlerInstallCount;
  int? get handlerHashCode => _handler?.hashCode;

  @override
  Future<dynamic> callNativeMethod(String method, [dynamic params]) async {
    final map = _asMap(params);
    final client = Client.instance;
    final realSdk =
        client is ClientWeb && client._sdkMode == 'real_sdk'
            ? client._realSdk
            : null;
    switch (method) {
      case _MethodKeys.addContact:
        final userId = map['userId']?.toString() ?? '';
        if (realSdk != null) {
          await realSdk.addContact(userId, map['reason']?.toString());
          _contacts.putIfAbsent(userId, () => {'userId': userId});
          return {method: userId};
        }
        _contacts.putIfAbsent(userId, () => {'userId': userId});
        return {method: userId};
      case _MethodKeys.deleteContact:
        final userId = map['userId']?.toString() ?? '';
        if (realSdk != null) {
          await realSdk.deleteContact(userId);
          _contacts.remove(userId);
          return {method: userId};
        }
        _contacts.remove(userId);
        return {method: userId};
      case _MethodKeys.getAllContactsFromServer:
        if (realSdk != null) {
          return {method: _mergeContactIds(await realSdk.getContactIds())};
        }
        return {method: _contactIds()};
      case _MethodKeys.getAllContactsFromDB:
        return {method: _contactIds()};
      case _MethodKeys.getAllContacts:
      case _MethodKeys.fetchAllContacts:
        if (realSdk != null) {
          return {method: _mergeContacts(await realSdk.getContacts())};
        }
        return {method: _contactList()};
      case _MethodKeys.fetchContacts:
        if (realSdk != null) {
          final result = await realSdk.getContactsWithCursor(
            pageSize: _asInt(map['pageSize']) ?? 20,
            cursor: map['cursor']?.toString() ?? '',
          );
          final list = result['list'];
          if (list is List) {
            result['list'] = _mergeContacts(_asContactList(list));
          }
          return {
            method: result,
          };
        }
        return {method: _fetchContacts(map)};
      case _MethodKeys.fetchAllContactIds:
      case _MethodKeys.getAllContactIds:
        if (realSdk != null) {
          return {method: _mergeContactIds(await realSdk.getContactIds())};
        }
        return {method: _contactIds()};
      case _MethodKeys.setContactRemark:
        final userId = map['userId']?.toString() ?? '';
        if (realSdk != null) {
          await realSdk.setContactRemark(
            userId: userId,
            remark: map['remark']?.toString() ?? '',
          );
          final contact =
              _contacts.putIfAbsent(userId, () => {'userId': userId});
          contact['remark'] = map['remark']?.toString() ?? '';
          return {method: true};
        }
        final contact = _contacts.putIfAbsent(userId, () => {'userId': userId});
        contact['remark'] = map['remark']?.toString() ?? '';
        return {method: true};
      case _MethodKeys.getContact:
        final userId = map['userId']?.toString() ?? '';
        if (realSdk != null) {
          final contacts = _mergeContacts(await realSdk.getContacts());
          for (final contact in contacts) {
            if (contact['userId']?.toString() == userId) {
              return {method: contact};
            }
          }
          return {method: null};
        }
        final contact = _contacts[userId];
        return {
          method: contact == null ? null : Map<String, dynamic>.from(contact),
        };
      case _MethodKeys.addUserToBlockList:
        final userId = map['userId']?.toString() ?? '';
        if (realSdk != null) {
          await realSdk.addUserToBlockList(userId);
          return {method: userId};
        }
        _blockList.add(userId);
        return {method: userId};
      case _MethodKeys.saveBlackList:
        final userIds =
            (map['userIds'] as List? ?? const [])
                .map((e) => e?.toString() ?? '')
                .where((e) => e.isNotEmpty)
                .toList();
        if (realSdk != null) {
          for (final userId in userIds) {
            await realSdk.addUserToBlockList(userId);
          }
          return {method: true};
        }
        _blockList.addAll(userIds);
        return {method: true};
      case _MethodKeys.removeUserFromBlockList:
        final userId = map['userId']?.toString() ?? '';
        if (realSdk != null) {
          await realSdk.removeUserFromBlockList(userId);
          return {method: userId};
        }
        _blockList.remove(userId);
        return {method: userId};
      case _MethodKeys.getBlockListFromServer:
        if (realSdk != null) {
          return {method: await realSdk.getBlockList()};
        }
        return {method: _blockList.toList()..sort()};
      case _MethodKeys.getBlockListFromDB:
        return {method: _blockList.toList()..sort()};
      case _MethodKeys.acceptInvitation:
        final userId = map['userId']?.toString() ?? '';
        if (realSdk != null) {
          await realSdk.acceptInvitation(userId);
          _contacts.putIfAbsent(userId, () => {'userId': userId});
          return {method: true};
        }
        _contacts.putIfAbsent(userId, () => {'userId': userId});
        return {method: true};
      case _MethodKeys.declineInvitation:
        if (realSdk != null) {
          await realSdk.declineInvitation(map['userId']?.toString() ?? '');
          return {method: true};
        }
        return {method: true};
      case _MethodKeys.getSelfIdsOnOtherPlatform:
        return {method: <String>[]};
      default:
        return _unsupported('ContactManager', method);
    }
  }

  Future<void> emitContactEvent(String method, [dynamic arguments]) async {
    await _handler?.call(MethodCall(method, arguments));
  }

  void reset() {
    _contacts.clear();
    _blockList.clear();
  }

  List<String> _contactIds() => _contacts.keys.toList()..sort();

  List<String> _mergeContactIds(List<String> ids) {
    return {...ids, ..._contacts.keys}.toList()..sort();
  }

  List<Map<String, dynamic>> _contactList() {
    return _contactIds()
        .map((userId) => Map<String, dynamic>.from(_contacts[userId]!))
        .toList();
  }

  List<Map<String, dynamic>> _mergeContacts(
    List<Map<String, dynamic>> contacts,
  ) {
    final merged = <String, Map<String, dynamic>>{};
    for (final contact in contacts) {
      final userId = contact['userId']?.toString() ?? '';
      if (userId.isNotEmpty) {
        merged[userId] = Map<String, dynamic>.from(contact);
      }
    }
    for (final entry in _contacts.entries) {
      merged[entry.key] = {
        ...?merged[entry.key],
        ...entry.value,
      };
    }
    return merged.values.toList()
      ..sort((a, b) => (a['userId'] ?? '')
          .toString()
          .compareTo((b['userId'] ?? '').toString()));
  }

  List<Map<String, dynamic>> _asContactList(List<dynamic> raw) {
    return raw
        .whereType<Map>()
        .map((item) => item.cast<String, dynamic>())
        .toList();
  }

  Map<String, dynamic> _fetchContacts(Map<String, dynamic> map) {
    return _fetchContactPage(map, _contactList());
  }

  Map<String, dynamic> _fetchContactPage(
    Map<String, dynamic> map,
    List<Map<String, dynamic>> contacts,
  ) {
    final pageSize =
        int.tryParse(map['pageSize']?.toString() ?? '') ?? contacts.length;
    final cursor = map['cursor']?.toString() ?? '';
    final start = int.tryParse(cursor) ?? 0;
    final end = (start + pageSize).clamp(start, contacts.length);
    final nextCursor = end >= contacts.length ? '' : end.toString();
    return {
      'cursor': nextCursor,
      'list': contacts.sublist(start, end),
    };
  }
}
